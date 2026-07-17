"""ASTRYX Code Reviewer — Automated code review and PR analysis.

Analyzes git diffs and code snippets for bugs, security issues,
performance problems, and style violations. Returns structured
reviews with severity scoring and suggested fixes.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import structlog

from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)


# ── Async Git Helpers ─────────────────────────────────────────────

async def _run_git_cmd(args: list[str], repo_path: str | None = None) -> str:
    """Run a git command asynchronously and return stdout."""
    try:
        process = await asyncio.create_subprocess_exec(
            *args,
            cwd=repo_path or os.getcwd(),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=15.0)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            logger.error("git_cmd_timeout", args=args)
            return ""
        if process.returncode == 0:
            return stdout.decode('utf-8', errors='ignore').strip()
        stderr_text = stderr.decode('utf-8', errors='ignore').strip()
        if stderr_text:
            logger.warning("git_cmd_stderr", args=args, stderr=stderr_text)
        return ""
    except FileNotFoundError:
        logger.error("git_not_found")
        return ""
    except Exception as e:
        logger.error("git_cmd_error", error=str(e))
        return ""


async def _get_git_diff(repo_path: str | None = None) -> str:
    """Get the current git diff (unstaged changes)."""
    diff = await _run_git_cmd(["git", "diff", "--unified=5"], repo_path)
    if diff:
        return diff
    # Try staged diff
    return await _run_git_cmd(["git", "diff", "--cached", "--unified=5"], repo_path)


async def _get_git_log(repo_path: str | None = None, count: int = 10) -> str:
    """Get recent git log entries."""
    return await _run_git_cmd(["git", "log", f"--max-count={count}", "--oneline"], repo_path)


async def _get_file_diff(file_path: str, repo_path: str | None = None) -> str:
    """Get git diff for a specific file."""
    return await _run_git_cmd(["git", "diff", "--unified=5", "--", file_path], repo_path)


# ── Review Logic ───────────────────────────────────────────────────

REVIEW_CATEGORIES = {
    "bug": {"label": "🐛 Bug", "color": "#ef4444", "weight": 10},
    "security": {"label": "🔐 Security", "color": "#f97316", "weight": 9},
    "performance": {"label": "⚡ Performance", "color": "#eab308", "weight": 7},
    "style": {"label": "🎨 Style", "color": "#3b82f6", "weight": 4},
    "suggestion": {"label": "💡 Suggestion", "color": "#8b5cf6", "weight": 3},
}


async def review_code(code: str, language: str = "", context: str = "") -> str:
    """Review a code snippet for issues and suggest fixes.

    Args:
        code: The code to review
        language: Programming language hint
        context: Additional context about what this code does

    Returns:
        JSON string with review results
    """
    if not code.strip():
        return json.dumps({"error": "No code provided to review."})

    lang_hint = f" ({language})" if language else ""
    ctx_hint = f"\nContext: {context}" if context else ""

    prompt = (
        f"Review the following code{lang_hint} thoroughly. {ctx_hint}\n\n"
        f"```{language}\n{code}\n```\n\n"
        f"Return ONLY a valid JSON object. No markdown, no backticks.\n\n"
        f"The JSON must have these fields:\n"
        f"- 'overall_score': integer 0-100\n"
        f"- 'summary': 2-3 sentence summary of the review\n"
        f"- 'strengths': array of strings listing what's good\n"
        f"- 'issues': array of objects, each with:\n"
        f"    - 'severity': one of 'critical', 'warning', 'info'\n"
        f"    - 'category': one of 'bug', 'security', 'performance', 'style', 'suggestion'\n"
        f"    - 'line': line number (or 0 if unknown)\n"
        f"    - 'message': short description of the issue\n"
        f"    - 'suggestion': how to fix it\n"
        f"- 'good_practices': array of strings with positive observations\n"
        f"- 'files_changed': 1 (number of logical files reviewed)\n\n"
        f"Be thorough. Check for bugs, security holes, performance issues, "
        f"and style violations. Score starts at 100 and deduct for each issue found."
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior software engineer conducting a thorough code review. "
                "You are strict but fair. You output ONLY valid JSON objects."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=4096),
            timeout=120,
        )
        cleaned = re.sub(r"```json|```", "", response).strip()
        result = json.loads(cleaned)

        # Ensure required fields exist
        if "overall_score" not in result:
            result["overall_score"] = 70
        if "issues" not in result:
            result["issues"] = []
        if "summary" not in result:
            result["summary"] = "Review completed."
        if "strengths" not in result:
            result["strengths"] = []
        if "good_practices" not in result:
            result["good_practices"] = []

        result["code_snippet"] = code[:500]  # Truncated preview
        result["language"] = language or "unknown"

        return json.dumps(result, default=str)

    except asyncio.TimeoutError:
        return json.dumps({"error": "Review timed out. Try a smaller code snippet."})
    except json.JSONDecodeError:
        return json.dumps({"error": "Failed to parse review. The code may be too complex.", "raw": response[:500]})
    except Exception as e:
        logger.error("code_review_failed", error=str(e))
        return json.dumps({"error": f"Review failed: {str(e)}"})


async def review_git_diff(repo_path: str | None = None) -> str:
    """Review the current git diff."""
    diff = await _get_git_diff(repo_path)
    if not diff:
        # Try log
        log = await _get_git_log(repo_path, 5)
        if log:
            return json.dumps({
                "overall_score": 0,
                "summary": "No uncommitted changes found. Here are recent commits:",
                "log": log,
                "issues": [],
                "strengths": [],
                "good_practices": [],
                "code_snippet": "",
                "language": "git"
            })
        return json.dumps({"error": "No git diff or commits found."})

    # Split diff into file sections
    files = re.split(r"^diff --git ", diff, flags=re.MULTILINE)
    file_reviews = []
    total_issues = 0
    total_score = 100
    all_issues = []

    for file_diff in files[1:]:  # Skip first empty split
        header_lines = file_diff.split("\n")[:5]
        file_path_match = re.search(r" b/(.+)$", header_lines[0])
        file_name = file_path_match.group(1) if file_path_match else "unknown"

        review_json = await review_code(
            code=file_diff[:3000],  # Limit per file
            language=file_name.split(".")[-1] if "." in file_name else "",
            context=f"Git diff for {file_name}"
        )

        try:
            review_data = json.loads(review_json)
            file_reviews.append({
                "file": file_name,
                "review": review_data
            })
            if "issues" in review_data:
                total_issues += len(review_data["issues"])
                all_issues.extend(review_data["issues"])
                total_score = min(total_score, review_data.get("overall_score", 100))
        except Exception:
            file_reviews.append({"file": file_name, "review": {"error": "Parse failed"}})

    # Aggregate results
    summary = (
        f"Reviewed {len(file_reviews)} file(s). Found {total_issues} issue(s). "
        f"Overall score: {total_score}/100."
    )

    result = {
        "overall_score": total_score,
        "summary": summary,
        "files_changed": len(file_reviews),
        "files": file_reviews,
        "issues": all_issues,
        "diff_preview": diff[:1000],
    }

    return json.dumps(result, default=str)


async def handle_review_command(data: str) -> str:
    """Handle the REVIEW tool command.

    Formats:
        git            — Review current git diff
        diff|...       — Review provided diff or code
        file|path      — Review a specific file
        code|code|lang — Review a code snippet
    """
    parts = data.split("|", 2) if "|" in data else [data]
    action = parts[0].strip().lower()

    if action == "git" or action == "diff":
        return await review_git_diff()

    elif action == "file":
        file_path = parts[1].strip() if len(parts) > 1 else ""
        if not file_path:
            return json.dumps({"error": "No file path provided."})
        if not os.path.exists(file_path):
            return json.dumps({"error": f"File not found: {file_path}"})
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                code = f.read()
            lang = file_path.split(".")[-1] if "." in file_path else ""
            return await review_code(code, lang, f"File: {file_path}")
        except Exception as e:
            return json.dumps({"error": f"Failed to read file: {str(e)}"})

    elif action == "code":
        code = parts[1].strip() if len(parts) > 1 else ""
        language = parts[2].strip() if len(parts) > 2 else ""
        if not code:
            return json.dumps({"error": "No code provided."})
        return await review_code(code, language)

    else:
        # Default: treat as code to review
        return await review_code(data)
