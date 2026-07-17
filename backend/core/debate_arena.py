"""ASTRYX Debate Arena — Multi-agent debate with synthesized conclusions.

Spawns multiple AI agents with different personas (Optimist, Skeptic,
Engineer, Designer, etc.) to debate a question from multiple perspectives,
then synthesizes the ultimate answer.
"""

from __future__ import annotations

import asyncio
import json
import structlog

from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)

DEFAULT_PERSONAS = [
    {
        "name": "Optimist",
        "role": "You are an optimistic visionary. You focus on opportunities, growth potential, and positive outcomes. You see the best in every situation and highlight upside potential.",
    },
    {
        "name": "Skeptic",
        "role": "You are a healthy skeptic. You challenge assumptions, identify risks, and probe for weaknesses. You ensure no blind spots are missed.",
    },
    {
        "name": "Strategist",
        "role": "You are a strategic analyst. You consider long-term implications, competitive dynamics, and systemic effects. You connect dots across domains.",
    },
    {
        "name": "Pragmatist",
        "role": "You are a grounded pragmatist. You focus on practical implementation, real-world constraints, and actionable next steps. You keep things realistic.",
    },
]


async def run_debate(question: str, personas: list[str] | None = None, rounds: int = 2) -> str:
    """Run a multi-agent debate on a question and synthesize a final answer.

    Args:
        question: The question or topic to debate
        personas: List of persona names to use (defaults to all 4)
        rounds: Number of debate rounds (each agent responds per round)

    Returns:
        JSON string with debate transcript and synthesized conclusion
    """
    logger.info("debate_start", question=question[:80], rounds=rounds)

    if not personas:
        selected_personas = DEFAULT_PERSONAS
    else:
        persona_map = {p["name"].lower(): p for p in DEFAULT_PERSONAS}
        selected_personas = []
        for name in personas:
            key = name.strip().lower()
            if key in persona_map:
                selected_personas.append(persona_map[key])
            else:
                # Create custom persona
                selected_personas.append({
                    "name": name.strip(),
                    "role": f"You are {name.strip()}, an expert with deep knowledge and a unique perspective. Analyze the question from your distinct viewpoint.",
                })

        if not selected_personas:
            selected_personas = DEFAULT_PERSONAS

    debate_log = []
    round_messages = []
    current_replies = {}

    try:
        for r in range(rounds):
            round_label = f"Round {r + 1}"
            logger.info("debate_round", round=r + 1, persona_count=len(selected_personas))

            round_replies = {}

            for persona in selected_personas:
                name = persona["name"]
                role = persona["role"]

                context = ""
                if round_messages:
                    # Build context from previous round
                    context = "\n\nPrevious arguments:\n" + "\n".join(
                        [f"[{m['name']}]: {m['content'][:300]}" for m in round_messages[-len(selected_personas):]]
                    )

                system_prompt = (
                    f"{role}\n\n"
                    f"You are participating in a structured debate about: {question}\n"
                    f"Respond concisely (2-4 sentences). Be specific and substantive. "
                    f"Address the previous speakers' points if available.{context}"
                )

                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Debate topic: {question}\n\nShare your perspective as {name}."},
                ]

                try:
                    response = await asyncio.wait_for(
                        lm_client.chat(messages, max_tokens=512),
                        timeout=60,
                    )
                    reply = response.strip()
                except asyncio.TimeoutError:
                    reply = f"[{name} timed out]"
                except Exception as e:
                    reply = f"[{name} error: {str(e)}]"

                round_replies[name] = reply
                debate_log.append({
                    "round": r + 1,
                    "speaker": name,
                    "content": reply,
                })

                current_replies[name] = reply

                await asyncio.sleep(0.1)  # Brief pause between agents

            # Store round context for next round
            for name, reply in round_replies.items():
                round_messages.append({"name": name, "content": reply})

        # ── Synthesize final answer ──
        debate_transcript = "\n\n".join([
            f"[Round {e['round']}] {e['speaker']}: {e['content']}"
            for e in debate_log
        ])

        synthesis_prompt = (
            f"You are an expert moderator and synthesizer. A debate was held on the topic:\\n\\n"
            f"'{question}'\\n\\n"
            f"Here is the full transcript:\\n\\n{debate_transcript}\\n\\n"
            f"Synthesize the debate into a comprehensive final answer. Structure it as:\\n\\n"
            f"### Consensus Points\\n- What all sides agree on\\n\\n"
            f"### Key Tensions\\n- Where the perspectives diverged and why\\n\\n"
            f"### Synthesized Conclusion\\n- Your balanced, well-reasoned final answer that incorporates "
            f"the strongest arguments from each perspective\\n\\n"
            f"### Actionable Recommendations\\n- 2-3 concrete next steps or recommendations\\n\\n"
            f"Be objective, thorough, and insightful."
        )

        messages = [
            {
                "role": "system",
                "content": "You are an expert debate moderator and synthesizer. You distill multiple perspectives into clear, balanced conclusions.",
            },
            {"role": "user", "content": synthesis_prompt},
        ]

        try:
            synthesis = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=2048),
                timeout=90,
            )
        except Exception as e:
            synthesis = f"**Synthesis failed:** {str(e)}"

        result = {
            "question": question,
            "personas": [p["name"] for p in selected_personas],
            "rounds": rounds,
            "transcript": debate_log,
            "synthesis": synthesis.strip(),
        }

        return json.dumps(result, default=str)

    except Exception as e:
        logger.error("debate_failed", error=str(e))
        return json.dumps({"error": f"Debate failed: {str(e)}"})


async def handle_debate_command(data: str) -> str:
    """Handle the DEBATE tool command.

    Format:
        question|persona1,persona2,...|rounds  — Full debate with options
        question                                — Simple debate with default personas and rounds
    """
    parts = data.split("|", 2) if "|" in data else [data]
    question = parts[0].strip()

    if not question:
        return json.dumps({
            "status": "usage",
            "message": "Usage: <DEBATE>question|personas|rounds</DEBATE>\n"
                       "Example: <DEBATE>Should I use PostgreSQL or MongoDB?|Optimist,Skeptic,Strategist|2</DEBATE>",
        })

    personas = None
    rounds = 2

    if len(parts) >= 2:
        persona_str = parts[1].strip()
        if persona_str:
            personas = [p.strip() for p in persona_str.split(",") if p.strip()]

    if len(parts) >= 3:
        try:
            rounds = int(parts[2].strip())
            rounds = max(1, min(rounds, 5))
        except ValueError:
            pass

    return await run_debate(question, personas, rounds)
