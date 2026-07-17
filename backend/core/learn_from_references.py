import asyncio
import json
import os
import re
import sys
from datetime import datetime

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from agents.automation import SystemAutomationAgent
from core.local_llm_client import lm_client

urls = [
    "https://youtu.be/RJDpRUKwaNo?si=0wy13Tuw61LpkkiL",
    "https://youtu.be/1itRFTf_OkA?si=1HzAkX_rtoi1tCBe",
    "https://youtu.be/NZWyn-APYRU?si=xjjb9FM9ZNWqAAYQ",
    "https://youtu.be/HvCcEMXKwpQ?si=PhJKkv5gyfb9kjmh",
    "https://youtu.be/qYEjY_03xFE?si=1OVFlXD5XZXdzqEM",
    "https://youtu.be/lvPUZswB3d4?si=0tdLV2XNtWfLZP7w",
    "https://youtu.be/sxRplBFGMHg?si=OwMyXDB4HXbdpLO3",
    "https://youtu.be/lk9FonEucZc?si=BVLlKuwELDPCh8OO",
    "https://youtu.be/JJ0TT98hCFk?si=kaZ9iTpAEOgJgWrr",
    "https://youtu.be/8ekBOCJYzrQ?si=-fLzhFePiIxIt-Jj",
    "https://youtu.be/v5TkaI8BEkw?si=5FoEz6sRCy2P2BeQ",
    "https://youtu.be/aQlTPUvVH5E?si=40H_D-Hkw7plK84F",
    "https://youtu.be/Y75ZpL5w7xE?si=GHLtEt03UVr89-bf",
    "https://youtu.be/MFwDZ3460Fc?si=X4y4-ItOhdCFCZSy"
]

async def learn_from_references():
    agent = SystemAutomationAgent()
    video_details = []
    
    print(f"Analyzing {len(urls)} reference videos...")
    for idx, url in enumerate(urls):
        print(f"[{idx+1}/{len(urls)}] Processing {url}...")
        try:
            res = await agent.youtube_extract(url)
            video_details.append(res)
        except Exception as e:
            print(f"Error processing {url}: {e}")
            
    print("Consolidating data and sending to Local LLM for trend synthesis...")
    
    combined_content = "\n\n=== VIDEO DATA ===\n\n".join(video_details)
    # Truncate if too large for context window
    if len(combined_content) > 18000:
        combined_content = combined_content[:18000] + "\n\n[... content truncated ...]"
        
    analysis_prompt = (
        "You are an elite presentation design director. You are training the Jarvis-X AI presentation builder "
        "to generate slides EXACTLY like the designs and techniques showcased in the following 14 viral YouTube "
        "PowerPoint tutorials (channels include Luis Urrutia, One Skill PowerPoint, and AnsonPPT):\n\n"
        f"{combined_content}\n\n"
        "TASKS:\n"
        "1. Extract all specific design ideas, color palettes, layout types, transitions (Morph settings), "
        "   and graphic embellishments taught in these videos.\n"
        "2. Formulate a comprehensive Markdown design manual containing:\n"
        "   - Key styles, guidelines, and tricks to make slides look ultra-premium and professional\n"
        "   - Platform-specific breakthroughs learned from these 14 videos\n"
        "   - Animation rules (how to name shapes like !!MorphBgCircle, !!CornerRotator to morph correctly)\n"
        "   - Layout rules (carousel, split-screen, grid layouts)\n"
        "3. Output a structured JSON config block specifying:\n"
        "   - 'font_title': Poppins or Montserrat\n"
        "   - 'font_body': Inter or Open Sans\n"
        "   - 'color_background': Dark theme background hex\n"
        "   - 'color_accent': Vibrant neon accent hex\n"
        "   - 'color_secondary': Secondary contrast color hex\n"
        "   - 'color_text': Crisp white text hex\n"
        "   - 'gradient_start': Background gradient start hex\n"
        "   - 'gradient_end': Background gradient end hex\n"
        "   - 'layout_preference': 'viral-editorial'\n"
        "   - 'transition_style': 'morph'\n"
        "   - 'visual_accent': '3d-perspective-rotator'\n\n"
        "OUTPUT FORMAT:\n"
        "Return the JSON config inside <STYLE_JSON>...</STYLE_JSON> tags.\n"
        "Return the Markdown report inside <REPORT_MD>...</REPORT_MD> tags.\n"
        "Do not write any conversational filler text outside these tags."
    )
    
    messages = [
        {"role": "system", "content": "You are a professional design training system. Output only structured JSON and Markdown inside their respective tags."},
        {"role": "user", "content": analysis_prompt}
    ]
    
    try:
        response = await lm_client.chat(messages, max_tokens=4000)
        
        # Parse STYLE_JSON
        json_match = re.search(r"<STYLE_JSON>([\s\S]*?)</STYLE_JSON>", response)
        style_rules = None
        if json_match:
            try:
                raw_json = json_match.group(1).strip()
                raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json)
                raw_json = re.sub(r"\s*```$", "", raw_json)
                style_rules = json.loads(raw_json)
            except Exception as je:
                print(f"JSON Parse Error: {je}")
                
        if not style_rules:
            # Fallback
            style_rules = {
                "font_title": "Montserrat",
                "font_body": "Inter",
                "color_background": "#0a0a0f",
                "color_accent": "#00ffff",
                "color_secondary": "#ff00ff",
                "color_text": "#ffffff",
                "gradient_start": "#0a0a0f",
                "gradient_end": "#1a0a2e",
                "layout_preference": "viral-editorial",
                "transition_style": "morph",
                "visual_accent": "3d-perspective-rotator"
            }
            
        style_rules["last_updated"] = datetime.now().isoformat()
        style_rules["reference_videos"] = urls
        
        # Save structured style rules
        os.makedirs(os.path.join(backend_dir, "data"), exist_ok=True)
        style_path = os.path.join(backend_dir, "data", "ppt_styles.json")
        with open(style_path, "w", encoding="utf-8") as f:
            json.dump(style_rules, f, indent=4, ensure_ascii=False)
        print(f"Saved PPT styles config to {style_path}")
        
        # Parse and save REPORT_MD
        md_match = re.search(r"<REPORT_MD>([\s\S]*?)</REPORT_MD>", response)
        report_md = md_match.group(1).strip() if md_match else response
        
        report_header = (
            f"# ASTRYX PowerPoint Design Manual — Learned from 14 YouTube References\n"
            f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"**Analyzed URLs**: {len(urls)} videos\n\n---\n\n"
        )
        full_report = report_header + report_md
        
        os.makedirs(os.path.join(backend_dir, "knowledge_base"), exist_ok=True)
        report_path = os.path.join(backend_dir, "knowledge_base", "presentation_trends.txt")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(full_report)
        print(f"Saved design report to {report_path}")
        
        print("Success! Jarvis-X has finished learning from all 14 reference videos.")
        
    except Exception as e:
        print(f"Failed trend synthesis: {e}")

if __name__ == "__main__":
    asyncio.run(learn_from_references())
