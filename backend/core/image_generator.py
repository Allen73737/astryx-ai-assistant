"""ASTRYX Image Generator — AI-powered image and art generation from text descriptions.

Generates images from natural language descriptions using available
AI image generation APIs or models. Creates unique artwork, diagrams,
illustrations, and visual content.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import structlog
import httpx
from datetime import datetime

from core.local_llm_client import lm_client
from config import settings

logger = structlog.get_logger(__name__)


async def generate_image(description: str, style: str = "digital-art", width: int = 1024, height: int = 768) -> str:
    """Generate an image from a text description.

    Uses available AI image generation capabilities. Falls back to
    curated Unsplash images if no dedicated image gen API is configured.

    Args:
        description: Text description of what to generate
        style: Art style (digital-art, watercolor, cyberpunk, minimalist, cinematic, etc.)
        width: Image width
        height: Image height

    Returns:
        JSON string with image path and metadata
    """
    logger.info("image_generate", description=description[:60], style=style)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_dir = os.path.join(base_dir, "data", "generated_images")
    os.makedirs(image_dir, exist_ok=True)

    safe_name = re.sub(r'[^\\w\\s]', '_', description[:40]).strip().lower()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(image_dir, f"gen_{safe_name}_{timestamp}.png")
    metadata_path = file_path.replace(".png", ".json")

    try:
        # Strategy 0: Python Code-to-Image Poster Generator
        if "poster" in description.lower() or "cinematic" in style.lower():
            logger.info("generating_python_poster", description=description[:40])
            png_path = await _generate_python_poster(description, style, file_path)
            if png_path and os.path.exists(png_path):
                result = {
                    "status": "success",
                    "path": png_path,
                    "format": "image",
                    "description": description,
                    "style": style,
                    "message": f"Generated programmatic poster: {description[:40]}",
                }
                with open(metadata_path, "w") as f:
                    json.dump(result, f, indent=2)
                return json.dumps(result)

        # Strategy 1: Try using a proper image generation API
        api_key = getattr(settings, "IMAGE_GEN_API_KEY", "")

        if api_key:
            # Generic image generation API call (works with various providers)
            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    resp = await client.post(
                        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={"inputs": f"{description}, {style} style, high quality"},
                    )
                    if resp.status_code == 200:
                        with open(file_path, "wb") as f:
                            f.write(resp.content)
                        logger.info("image_gen_api_success", file=file_path, size=len(resp.content))
                    else:
                        logger.warning("image_gen_api_failed", status=resp.status_code)
                        api_key = ""  # Fall through
            except Exception as e:
                logger.warning("image_gen_api_error", error=str(e))
                api_key = ""

        # Strategy 2: Use Unsplash as curated image source (always falls back here)
        if not os.path.exists(file_path):
            # Try cache-first download (rate-limit safe)
            from core.ppt_generator import download_unsplash_image
            result_path = await download_unsplash_image(description)
            if result_path:
                # Convert to our naming convention
                import shutil
                shutil.copy2(result_path, file_path)
            else:
                # Last resort: direct CDN from cache for common fallback keywords
                from core.unsplash_cache import unsplash_cache
                fallback_url = unsplash_cache.get_cached("abstract")
                if fallback_url:
                    import httpx
                    try:
                        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
                            resp = await client.get(fallback_url)
                            if resp.status_code == 200 and len(resp.content) > 5000:
                                with open(file_path, "wb") as f:
                                    f.write(resp.content)
                    except Exception:
                        pass

        # Strategy 3: Generate HTML/SVG-based artwork as ultimate fallback
        if not os.path.exists(file_path) or os.path.getsize(file_path) < 1000:
            logger.info("generating_svg_fallback", description=description[:40])
            svg = await _generate_svg_artwork(description, style)
            if svg:
                svg_path = file_path.replace(".png", ".svg")
                with open(svg_path, "w", encoding="utf-8") as f:
                    f.write(svg)

                result = {
                    "status": "success",
                    "path": svg_path,
                    "format": "svg",
                    "description": description,
                    "style": style,
                    "message": f"Generated SVG artwork: {description[:40]}",
                }
                # Save metadata
                with open(metadata_path, "w") as f:
                    json.dump(result, f, indent=2)
                return json.dumps(result)

            return json.dumps({
                "status": "partial",
                "description": description,
                "message": "Could not generate a new image. Try using <PPT>generate|topic|slides</PPT> to create slides with Unsplash images instead.",
            })

        result = {
            "status": "success",
            "path": file_path,
            "format": "image",
            "description": description,
            "style": style,
            "width": width,
            "height": height,
        }
        with open(metadata_path, "w") as f:
            json.dump(result, f, indent=2)
        return json.dumps(result)

    except Exception as e:
        logger.error("image_generation_failed", error=str(e))
        return json.dumps({"error": f"Image generation failed: {str(e)}"})


async def _generate_python_poster(description: str, style: str, output_path: str) -> str | None:
    """Generate a high-quality poster using a dynamically generated Python Pillow script."""
    prompt = (
        f"Write a complete, standalone Python script using the 'PIL' (Pillow) library to generate an absolutely jaw-dropping, ULTRA-PREMIUM, ultra-cinematic generative art poster.\\n"
        f"Description: '{description}'\\n"
        f"Style: {style}\\n\\n"
        f"CRITICAL REQUIREMENTS (Level: Absolute Masterpiece):\\n"
        f"- The script MUST save the final image to exactly this path: r'{output_path}'\\n"
        f"- Use a massive resolution of 1440x2560 (vertical 2K cinematic poster format).\\n"
        f"- YOU MUST ADD MALAYALAM TEXT/TYPOGRAPHY. To do this, your script MUST download a premium Malayalam font from Google Fonts (e.g., 'Manjari', 'Chilanka', 'Gayathri', or 'Noto Sans Malayalam') using `urllib.request.urlretrieve` to a temporary `.ttf` file before drawing the text.\\n"
        f"- Render distinct, beautiful font styles. Mix massive, bold Malayalam titles with elegant, tracked-out English subtitles.\\n"
        f"- Implement insane, ultra-advanced cinematic backgrounds: use dynamic multi-color radial/linear gradients, draw complex intersecting wireframes/geometric shapes, and apply extreme glassmorphism blurs (`ImageFilter.GaussianBlur(150)`).\\n"
        f"- Use `ImageChops` (Screen, Multiply, Add) to blend complex lighting overlays, glowing neon accents, and noise/film-grain textures for a high-end Hollywood studio aesthetic.\\n"
        f"- Create 3D text effects by stacking the same text multiple times with decreasing blur and opacity to create intense glowing neon or deep shadow drops.\\n"
        f"- Do NOT use `ImageFont.load_default()`. You MUST download real `.ttf` fonts for both English (e.g., 'Montserrat', 'Oswald', or 'Cinzel') and Malayalam.\\n"
        f"- Push Pillow to its absolute limits. Ensure the code is robust and handles errors gracefully.\\n"
        f"- Return ONLY the raw Python code enclosed in ```python tags.\\n"
    )

    messages = [
        {"role": "system", "content": "You are an expert Python developer and generative artist. You write pristine Pillow code to render high-end graphic design posters."},
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=4096),
            timeout=120,
        )
        code_match = re.search(r"```python\s*\\n(.*?)```", response, re.DOTALL)
        if code_match:
            script_code = code_match.group(1).strip()
            
            import tempfile
            import subprocess
            import sys
            
            with tempfile.NamedTemporaryFile(suffix=".py", delete=False) as tf:
                tf.write(script_code.encode("utf-8"))
                script_path = tf.name
                
            try:
                # Execute the generated script
                proc = await asyncio.to_thread(
                    subprocess.run,
                    [sys.executable, script_path],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                if proc.returncode == 0 and os.path.exists(output_path):
                    return output_path
                else:
                    logger.error("python_poster_execution_failed", stdout=proc.stdout, stderr=proc.stderr)
            finally:
                try: os.remove(script_path)
                except: pass
    except Exception as e:
        logger.warning("python_poster_generation_failed", error=str(e))

    return None

async def _generate_svg_artwork(description: str, style: str) -> str:
    """Generate SVG artwork using the LLM as a creative fallback."""
    prompt = (
        f"Create a beautiful, modern SVG artwork based on this description: '{description}'\\n\\n"
        f"Style: {style}\\n\\n"
        f"Requirements:\\n"
        f"- Return ONLY valid SVG code with ```svg tags\\n"
        f"- Use ASTRYX dark theme colors (#0a0a0f, #00e5ff, #a855f7, #10b981)\\n"
        f"- Clean, minimal, professional design\\n"
        f"- Responsive viewBox (0 0 800 600)\\n"
        f"- Use gradients, shapes, and geometric patterns\\n"
        f"- No external images or complex raster effects\\n"
        f"- Make it visually impressive and portfolio-quality\\n\\n"
        f"Return ONLY the SVG code."
    )

    messages = [
        {"role": "system", "content": "You are an expert SVG artist. You create stunning, modern vector artwork using pure SVG code."},
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=4096),
            timeout=120,
        )
        svg_match = re.search(r"```svg\s*\n(.*?)```", response, re.DOTALL)
        if svg_match:
            svg = svg_match.group(1).strip()
        else:
            svg_match = re.search(r"(<svg[^>]*>.*?</svg>)", response, re.DOTALL)
            svg = svg_match.group(1).strip() if svg_match else ""

        if svg and "<svg" in svg and "</svg>" in svg:
            return svg
    except Exception as e:
        logger.warning("svg_generation_failed", error=str(e))

    return ""


async def list_generated_images() -> str:
    """List all previously generated images."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_dir = os.path.join(base_dir, "data", "generated_images")
    os.makedirs(image_dir, exist_ok=True)

    images = []
    for f in os.listdir(image_dir):
        if f.endswith((".png", ".svg", ".jpg", ".jpeg")):
            json_path = os.path.join(image_dir, f.replace(".png", ".json").replace(".svg", ".json"))
            metadata = {}
            if os.path.exists(json_path):
                try:
                    with open(json_path) as jf:
                        metadata = json.load(jf)
                except Exception:
                    pass
            images.append({
                "file": f,
                "path": os.path.join(image_dir, f),
                "metadata": metadata,
            })

    return json.dumps({
        "images": images,
        "count": len(images),
        "directory": image_dir,
    })


async def handle_imagen_command(data: str) -> str:
    """Handle the IMAGEN tool command.

    Format:
        description|style|width|height  — Generate image with options
        description                      — Generate image with defaults
        list                             — List generated images
    """
    parts = data.split("|", 3) if "|" in data else [data]
    action = parts[0].strip().lower()

    if action == "list":
        return await list_generated_images()

    description = parts[0].strip()
    if not description:
        return json.dumps({
            "status": "usage",
            "message": "Usage: <IMAGEN>description|style|width|height</IMAGEN>\n"
                       "Styles: digital-art, watercolor, cyberpunk, minimalist, cinematic, abstract, geometric\n"
                       "Example: <IMAGEN>A cyberpunk cityscape with neon lights|cyberpunk|1024|768</IMAGEN>",
        })

    style = parts[1].strip() if len(parts) > 1 and parts[1].strip() else "digital-art"
    width = int(parts[2].strip()) if len(parts) > 2 and parts[2].strip().isdigit() else 1024
    height = int(parts[3].strip()) if len(parts) > 3 and parts[3].strip().isdigit() else 768

    width = max(256, min(width, 2048))
    height = max(256, min(height, 2048))

    return await generate_image(description, style, width, height)
