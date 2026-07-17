import os
import asyncio
import pythoncom
import win32com.client
import structlog
from datetime import datetime

from core.local_llm_client import lm_client
from core.ppt_generator import run_in_dedicated_sta_thread_async, _bring_powerpoint_to_front

logger = structlog.get_logger(__name__)

async def analyze_and_merge_ppts(path1: str, path2: str) -> str | None:
    """Intelligently merge two PPTs, unifying the theme and generating a bridge slide."""
    
    if not os.path.exists(path1) or not os.path.exists(path2):
        logger.error("ppt_merge_files_not_found", p1=path1, p2=path2)
        return None

    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "presentations")
    os.makedirs(out_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(out_dir, f"Merged_Presentation_{timestamp}.pptx")

    # We need to run the entire COM operation in an STA thread
    return await run_in_dedicated_sta_thread_async(_com_merge_ppts, path1, path2, output_path)

def _extract_text_from_slide(slide) -> str:
    text = []
    for shape in slide.Shapes:
        if shape.HasTextFrame:
            if shape.TextFrame.HasText:
                text.append(shape.TextFrame.TextRange.Text)
    return " ".join(text).replace('\r', ' ').replace('\n', ' ')

def _com_merge_ppts(path1: str, path2: str, output_path: str) -> str | None:
    """The synchronous COM worker that does the actual extraction, LLM call, and merging."""
    pythoncom.CoInitialize()
    try:
        ppt_app = win32com.client.Dispatch("PowerPoint.Application")
        ppt_app.Visible = True
        
        # Open both presentations
        pres1 = ppt_app.Presentations.Open(path1, False, False, True)
        pres2 = ppt_app.Presentations.Open(path2, False, False, True)
        
        # 1. Extract context for the bridge slide
        p1_context = []
        p2_context = []
        
        # Get last 2 slides of PPT1
        start_idx1 = max(1, pres1.Slides.Count - 1)
        for i in range(start_idx1, pres1.Slides.Count + 1):
            p1_context.append(_extract_text_from_slide(pres1.Slides(i)))
            
        # Get first 2 slides of PPT2
        end_idx2 = min(pres2.Slides.Count, 2)
        for i in range(1, end_idx2 + 1):
            p2_context.append(_extract_text_from_slide(pres2.Slides(i)))
            
        context1_str = " ".join(p1_context)
        context2_str = " ".join(p2_context)
        
        # 2. Synchronous LLM call for bridge content
        prompt = (
            "You are an expert presentation designer. I have two PowerPoint presentations that I am merging.\n"
            f"End of Presentation 1: '{context1_str[:1000]}'\n"
            f"Start of Presentation 2: '{context2_str[:1000]}'\n\n"
            "Generate a brilliant, cinematic 'Bridge Slide' that seamlessly connects the narrative of Presentation 1 to Presentation 2.\n"
            "Format the output strictly as: TITLE|||SUBTITLE\n"
            "Keep the title short (2-5 words) and the subtitle elegant and transitional (1 sentence)."
        )
        
        import threading
        # We must use a new event loop or call sync since we are in a worker thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            response = loop.run_until_complete(
                lm_client.chat([{"role": "user", "content": prompt}], max_tokens=150)
            )
        finally:
            loop.close()
            
        bridge_title = "Transition"
        bridge_sub = "Moving to the next section..."
        if "|||" in response:
            parts = response.split("|||")
            bridge_title = parts[0].strip()
            bridge_sub = parts[1].strip()
            
        # 3. Add Bridge Slide to PPT1
        # ppLayoutBlank = 12, ppLayoutText = 2, ppLayoutTitle = 1
        # We'll add a blank slide and format it cinematically
        bridge_slide = pres1.Slides.Add(pres1.Slides.Count + 1, 12)
        
        # Force the design of Slide 1 onto the bridge slide to unify it
        try:
            bridge_slide.Design = pres1.Slides(1).Design
        except Exception as e:
            logger.warning("could_not_apply_design_to_bridge", error=str(e))
            
        # Add cinematic title
        title_box = bridge_slide.Shapes.AddTextbox(1, 50, 200, 860, 150)
        tf = title_box.TextFrame
        tf.WordWrap = True
        p = tf.TextRange
        p.Text = bridge_title
        p.Font.Size = 100
        p.Font.Bold = True
        p.ParagraphFormat.Alignment = 2 # Center
        
        # 3D Extrusion on bridge slide
        try:
            title_box.ThreeD.Visible = -1
            title_box.ThreeD.Depth = 10
            title_box.ThreeD.RotationY = -5
        except: pass

        # Subtitle
        sub_box = bridge_slide.Shapes.AddTextbox(1, 50, 360, 860, 50)
        p_sub = sub_box.TextFrame.TextRange
        p_sub.Text = bridge_sub
        p_sub.Font.Size = 28
        p_sub.Font.Italic = True
        p_sub.ParagraphFormat.Alignment = 2
        
        # Morph Transition for bridge
        try:
            # ppTransitionMorph = 1
            bridge_slide.SlideShowTransition.EntryEffect = 1
        except: pass

        # 4. Merge PPT2 into PPT1
        # Copy slides from pres2 and paste into pres1
        for i in range(1, pres2.Slides.Count + 1):
            pres2.Slides(i).Copy()
            pres1.Slides.Paste(pres1.Slides.Count + 1)
            pasted_slide = pres1.Slides(pres1.Slides.Count)
            
            # Thematic Unification: Force the Master Design of PPT1 onto the pasted slide
            try:
                pasted_slide.Design = pres1.Slides(1).Design
            except Exception as e:
                logger.warning("could_not_apply_design_to_pasted_slide", error=str(e))
                
            # Apply Morph transition
            try:
                pasted_slide.SlideShowTransition.EntryEffect = 1
            except: pass

        # Close PPT2
        pres2.Close()
        
        # Save PPT1 to output path
        # ppSaveAsOpenXMLPresentation = 24
        pres1.SaveAs(output_path, 24)
        pres1.Close()
        
        _bring_powerpoint_to_front()
        return output_path

    except Exception as e:
        logger.error("com_merge_failed", error=str(e))
        return None
    finally:
        pythoncom.CoUninitialize()
