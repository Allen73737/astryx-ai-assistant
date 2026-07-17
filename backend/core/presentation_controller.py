"""PowerPoint slideshow voice control and COM navigation."""

from __future__ import annotations

import re
import structlog
import pythoncom
import win32com.client

logger = structlog.get_logger(__name__)

NEXT_PATTERNS = (
    r"^next(\s+slide)?[.!]?$",
    r"^(go\s+)?forward[.!]?$",
    r"^slide\s+forward[.!]?$",
    r"^advance[.!]?$",
)

PREV_PATTERNS = (
    r"^previous(\s+slide)?[.!]?$",
    r"^prev(\s+slide)?[.!]?$",
    r"^(go\s+)?back[.!]?$",
    r"^last\s+slide[.!]?$",
)

END_PATTERNS = (
    r"^end(\s+(the\s+)?(presentation|slideshow))?[.!]?$",
    r"^stop(\s+(the\s+)?(presentation|slideshow))?[.!]?$",
    r"^exit(\s+(the\s+)?(presentation|slideshow))?[.!]?$",
)


class PresentationController:
    def __init__(self) -> None:
        self._voice_control_enabled = False

    @property
    def voice_control_enabled(self) -> bool:
        return self._voice_control_enabled

    def enable_voice_control(self) -> None:
        self._voice_control_enabled = True
        logger.info("presentation_voice_control_enabled")

    def disable_voice_control(self) -> None:
        self._voice_control_enabled = False
        logger.info("presentation_voice_control_disabled")

    def is_slideshow_active(self) -> bool:
        try:
            pythoncom.CoInitialize()
            try:
                ppt = win32com.client.GetActiveObject("PowerPoint.Application")
                return int(ppt.SlideShowWindows.Count) > 0
            finally:
                pythoncom.CoUninitialize()
        except Exception:
            return False

    def next_slide(self) -> str:
        try:
            pythoncom.CoInitialize()
            try:
                ppt = win32com.client.GetActiveObject("PowerPoint.Application")
                if int(ppt.SlideShowWindows.Count) < 1:
                    self.disable_voice_control()
                    return "No active slideshow found."
                view = ppt.SlideShowWindows(1).View
                view.Next()
                slide_num = int(view.Slide.SlideIndex)
                return f"Advanced to slide {slide_num}."
            finally:
                pythoncom.CoUninitialize()
        except Exception as exc:
            return f"Could not advance slide: {exc}"

    def previous_slide(self) -> str:
        try:
            pythoncom.CoInitialize()
            try:
                ppt = win32com.client.GetActiveObject("PowerPoint.Application")
                if int(ppt.SlideShowWindows.Count) < 1:
                    self.disable_voice_control()
                    return "No active slideshow found."
                view = ppt.SlideShowWindows(1).View
                view.Previous()
                slide_num = int(view.Slide.SlideIndex)
                return f"Went back to slide {slide_num}."
            finally:
                pythoncom.CoUninitialize()
        except Exception as exc:
            return f"Could not go to previous slide: {exc}"

    def end_slideshow(self) -> str:
        try:
            pythoncom.CoInitialize()
            try:
                ppt = win32com.client.GetActiveObject("PowerPoint.Application")
                if int(ppt.SlideShowWindows.Count) < 1:
                    self.disable_voice_control()
                    return "No active slideshow found."
                view = ppt.SlideShowWindows(1).View
                view.Exit()
                self.disable_voice_control()
                return "Presentation ended."
            finally:
                pythoncom.CoUninitialize()
        except Exception as exc:
            return f"Could not end slideshow: {exc}"

    def _normalize(self, text: str) -> str:
        cleaned = text.lower().strip()
        cleaned = re.sub(r"[^\w\s]", "", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        # Strip wake words so "astryx next slide" still works
        for wake in ("astryx", "asterix", "astrix", "jarvis", "hey jarvis"):
            cleaned = cleaned.replace(wake, "").strip()
        return cleaned

    def try_handle_command(self, text: str) -> tuple[bool, str]:
        """Return (handled, message) for presentation voice commands."""
        if not self._voice_control_enabled and not self.is_slideshow_active():
            return False, ""

        normalized = self._normalize(text)
        if not normalized:
            return False, ""

        for pattern in NEXT_PATTERNS:
            if re.match(pattern, normalized):
                return True, self.next_slide()

        for pattern in PREV_PATTERNS:
            if re.match(pattern, normalized):
                return True, self.previous_slide()

        for pattern in END_PATTERNS:
            if re.match(pattern, normalized):
                return True, self.end_slideshow()

        return False, ""


presentation_controller = PresentationController()
