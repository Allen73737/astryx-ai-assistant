"""Code Explainer Engine — Generates code from questions, explains line-by-line and block-by-block with full summary.

Pipeline:
1. Takes a natural language programming question (or code to explain)
2. If a question, generates a complete code solution using the LLM
3. Explains every line and logical block in detail
4. Provides a comprehensive summary at the end
"""

import asyncio
import re
import structlog

from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)


async def explain_code_line_by_line(code: str, language: str) -> str:
    """Use LLM to explain a block of code line-by-line and block-by-block."""
    prompt = (
        f"You are an elite programming tutor. Explain the following {language} code "
        f"in extreme detail. Structure your explanation into THREE clear parts:\n\n"
        f"## PART 1 — HIGH-LEVEL OVERVIEW\n"
        f"Briefly describe what this code does (2-3 sentences max).\n\n"
        f"## PART 2 — LINE-BY-LINE & BLOCK-BY-BLOCK EXPLANATION\n"
        f"For each logical block or significant line:\n"
        f"- Show the code snippet\n"
        f"- Explain what it does, why it's needed, and how it works\n"
        f"- Note any important syntax, edge cases, or design patterns\n\n"
        f"## PART 3 — FULL SUMMARY\n"
        f"Provide a comprehensive summary covering:\n"
        f"- What the overall code achieves\n"
        f"- Key algorithms, data structures, or patterns used\n"
        f"- Potential improvements or gotchas\n"
        f"- How the pieces fit together\n\n"
        f"CODE TO EXPLAIN ({language}):\n"
        f"```{language}\n{code}\n```\n\n"
        f"Be thorough and educational. Assume the learner understands basic syntax "
        f"but wants deep comprehension."
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an elite programming tutor with deep expertise across all major languages. "
                "You explain code with crystal clarity, connecting each line to the bigger picture. "
                "You use markdown formatting for readability — headings, code blocks, and bullet points."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=4096),
            timeout=120,
        )
        return response.strip()
    except asyncio.TimeoutError:
        logger.error("code_explain_timeout")
        return "**Error**: Code explanation timed out. The code may be too long or the LLM is overloaded. Try a smaller snippet."
    except Exception as e:
        logger.error("code_explain_failed", error=str(e))
        return f"**Error**: Failed to explain code — {str(e)}"


async def generate_and_explain(question: str, language: str = "python") -> str:
    """Generate code from a natural language question, then explain it in detail.

    Args:
        question: Natural language programming question
        language: Target programming language

    Returns:
        Full explanation with generated code, line-by-line breakdown, and summary
    """
    logger.info("code_explain_generate", question=question[:80], language=language)

    # ── Step 1: Generate the code ──
    gen_prompt = (
        f"You are an expert {language} developer. Write clean, well-commented, production-quality code "
        f"to solve the following problem:\n\n{question}\n\n"
        f"Requirements:\n"
        f"- Use proper {language} idioms and best practices\n"
        f"- Include docstrings/comments explaining the logic\n"
        f"- Handle edge cases and errors gracefully\n"
        f"- Write a complete, runnable solution\n"
        f"- If applicable, include a small example usage at the bottom (guarded by `if __name__ == '__main__':` "
        f"or equivalent)\n\n"
        f"Return ONLY the code block with ```{language} tags."
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"You are an expert {language} developer who writes clean, idiomatic, "
                f"well-documented production code. You output ONLY valid code blocks."
            ),
        },
        {"role": "user", "content": gen_prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=4096),
            timeout=120,
        )
        # Extract just the code block
        code_match = re.search(
            r"```(?:\w+)?\n(.*?)```", response, re.DOTALL
        )
        if code_match:
            generated_code = code_match.group(1).strip()
        else:
            # Fallback: use whole response, strip markdown fences
            generated_code = re.sub(r"```\w*", "", response).strip()
            if generated_code.endswith("```"):
                generated_code = generated_code[:-3].strip()
    except asyncio.TimeoutError:
        logger.error("code_gen_timeout")
        return "**Error**: Code generation timed out. Please try a simpler question."
    except Exception as e:
        logger.error("code_gen_failed", error=str(e))
        return f"**Error**: Failed to generate code — {str(e)}"

    if not generated_code:
        return "**Error**: No code was generated. Please rephrase your question."

    # ── Step 2: Explain the generated code ──
    explanation = await explain_code_line_by_line(generated_code, language)

    # ── Step 3: Assemble the full response ──
    full_response = (
        f"# 🧠 Code Explainer\n\n"
        f"## ❓ Your Question\n{question}\n\n"
        f"---\n\n"
        f"## 💻 Generated Code ({language})\n\n"
        f"```{language}\n{generated_code}\n```\n\n"
        f"---\n\n"
        f"{explanation}\n\n"
        f"---\n\n"
        f"*Generated and explained by ASTRYX Code Explainer Engine*"
    )

    return full_response


async def explain_code(code: str, language: str = "python") -> str:
    """Take existing code and explain it line-by-line with summary."""
    logger.info("code_explain_existing", code_len=len(code), language=language)

    if not code.strip():
        return "**Error**: No code provided to explain."

    explanation = await explain_code_line_by_line(code, language)

    full_response = (
        f"# 🧠 Code Explainer\n\n"
        f"## 💻 Code to Explain ({language})\n\n"
        f"```{language}\n{code}\n```\n\n"
        f"---\n\n"
        f"{explanation}\n\n"
        f"---\n\n"
        f"*Explained by ASTRYX Code Explainer Engine*"
    )

    return full_response


async def handle_compiler_command(data: str) -> str:
    """Handle the COMPILER tool command.

    Format:
        question|language  — Generate code from a question and explain it
        explain|code|language  — Explain existing code
    """
    parts = data.split("|", 2) if "|" in data else [data]
    action = parts[0].strip().lower()

    if action == "explain":
        if len(parts) >= 2:
            code = parts[1].strip()
            language = parts[2].strip() if len(parts) >= 3 else "python"
            return await explain_code(code, language)
        else:
            return (
                "**COMPILER Usage**:\n"
                "- `question|language` — Ask a programming question and get code + explanation\n"
                "- `explain|code|language` — Explain existing code line-by-line\n\n"
                "**Examples**:\n"
                "`COMPILER>Write a Python sorting function|python`\n"
                "`COMPILER>explain|def hello(): print('hi')|python`"
            )
    else:
        # Action is actually the question, parse language if provided
        question = parts[0].strip()
        language = parts[1].strip() if len(parts) >= 2 and parts[1].strip() else "python"
        return await generate_and_explain(question, language)
