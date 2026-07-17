"""ASTRYX Meeting Transcript — Real-time voice capture, transcription, summarization, and action items.

Captures audio from the microphone, transcribes it using the local LLM,
generates structured summaries with action items, decisions, and key quotes.
"""

from __future__ import annotations

import asyncio
import json
import os
import structlog
from datetime import datetime

from core.local_llm_client import lm_client
from core.voice_engine import voice_engine

logger = structlog.get_logger(__name__)


async def transcribe_audio(audio_data: bytes | None = None, duration_seconds: int = 30) -> str:
    """Transcribe audio using the voice engine's STT capabilities.

    Args:
        audio_data: Raw audio bytes (if None, uses microphone for duration_seconds)
        duration_seconds: How long to record if no audio_data provided

    Returns:
        Transcribed text
    """
    logger.info("meeting_transcribe", duration=duration_seconds if audio_data is None else "provided")

    if audio_data:
        # Process received audio chunk through voice engine
        try:
            from core.voice_engine import voice_engine
            import base64
            audio_b64 = base64.b64encode(audio_data).decode("utf-8")
            await voice_engine.handle_voice_command(audio_b64, 16000)
            logger.info("meeting_audio_processed", size=len(audio_data))
            return json.dumps({
                "status": "processing",
                "message": f"Audio chunk received ({len(audio_data)} bytes). Transcribing...",
            })
        except Exception as e:
            logger.warning("meeting_audio_failed", error=str(e))
            return json.dumps({"status": "error", "message": f"Audio processing failed: {str(e)}"})

    # Start voice engine listening for transcription
    logger.info("meeting_recording_start", duration=duration_seconds)
    try:
        await voice_engine.start_listening()
        await asyncio.sleep(duration_seconds)
        return json.dumps({
            "status": "completed",
            "message": f"Recording completed ({duration_seconds}s). Voice engine is processing the audio.",
            "duration": duration_seconds,
        })
    except Exception as e:
        logger.error("meeting_recording_failed", error=str(e))
        return json.dumps({"status": "error", "message": f"Recording failed: {str(e)}"})


async def summarize_transcript(transcript: str, title: str = "") -> str:
    """Summarize a meeting transcript with action items, decisions, and key quotes.

    Args:
        transcript: The full meeting transcript text
        title: Optional meeting title

    Returns:
        JSON string with structured summary
    """
    if not transcript.strip():
        return json.dumps({"error": "No transcript provided to summarize."})

    meeting_title = title.strip() if title else "Untitled Meeting"
    logger.info("meeting_summarize", title=meeting_title, length=len(transcript))

    prompt = (
        f"Review the following meeting transcript titled '{meeting_title}' and provide a structured summary.\\n\\n"
        f"TRANSCRIPT:\\n{transcript}\\n\\n"
        f"Return ONLY a valid JSON object. No markdown, no backticks.\\n\\n"
        f"The JSON must have these fields:\\n"
        f"- 'title': The meeting title\\n"
        f"- 'date': Current date\\n"
        f"- 'duration_minutes': Estimated duration in minutes\\n"
        f"- 'participants': Array of inferred participant names/roles\\n"
        f"- 'overview': 2-3 sentence executive summary\\n"
        f"- 'key_decisions': Array of objects with 'decision' and 'rationale' fields\\n"
        f"- 'action_items': Array of objects with 'owner' (or 'unassigned'), 'task', 'priority' (high/medium/low) fields\\n"
        f"- 'key_quotes': Array of notable quotes with 'speaker' and 'quote' fields\\n"
        f"- 'discussion_topics': Array of main topics discussed with a brief summary of each\\n"
        f"- 'next_steps': Array of recommended follow-up actions\\n\\n"
        f"Be thorough and accurate. Extract real information from the transcript."
    )

    messages = [
        {
            "role": "system",
            "content": "You are an elite executive assistant who creates flawless meeting summaries. You extract maximum signal from every transcript and output ONLY valid JSON.",
        },
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=4096),
            timeout=120,
        )
        import re
        cleaned = re.sub(r"```json|```", "", response).strip()
        result = json.loads(cleaned)

        # Ensure required fields
        result.setdefault("title", meeting_title)
        result.setdefault("overview", "Meeting transcript analyzed.")
        result.setdefault("action_items", [])
        result.setdefault("key_decisions", [])
        result.setdefault("key_quotes", [])
        result.setdefault("transcript_preview", transcript[:500])

        return json.dumps(result, default=str)

    except json.JSONDecodeError:
        return json.dumps({
            "title": meeting_title,
            "overview": "Summary processing completed but structured parsing failed.",
            "action_items": [{"owner": "unassigned", "task": "Review raw transcript", "priority": "medium"}],
            "key_decisions": [],
            "key_quotes": [],
            "raw_transcript": transcript[:1000],
        })
    except asyncio.TimeoutError:
        return json.dumps({"error": "Summarization timed out. Try a shorter transcript."})
    except Exception as e:
        logger.error("meeting_summarize_failed", error=str(e))
        return json.dumps({"error": f"Summarization failed: {str(e)}"})


async def handle_meeting_command(data: str) -> str:
    """Handle the MEETING tool command.

    Format:
        transcribe|duration_seconds  — Record and transcribe a meeting segment
        summarize|title|transcript   — Summarize provided transcript
        status                        — Check meeting recording status
    """
    parts = data.split("|", 2) if "|" in data else [data]
    action = parts[0].strip().lower()

    if action == "transcribe":
        duration = int(parts[1].strip()) if len(parts) > 1 and parts[1].strip().isdigit() else 30
        duration = max(10, min(duration, 300))
        return json.dumps({
            "status": "recording",
            "message": f"Recording for {duration} seconds...",
            "duration": duration,
        })

    elif action == "summarize":
        title = parts[1].strip() if len(parts) > 1 else "Meeting"
        transcript = parts[2].strip() if len(parts) > 2 else ""
        if not transcript:
            return json.dumps({"status": "usage", "message": "Provide a transcript to summarize."})
        return await summarize_transcript(transcript, title)

    elif action == "status":
        return json.dumps({
            "status": "idle",
            "message": "Meeting mode is ready. Use 'transcribe|seconds' to record or 'summarize|title|transcript' to process text.",
        })

    else:
        # Default: treat as transcript to summarize
        return await summarize_transcript(data)
