import asyncio
import edge_tts
import tempfile
import os
import pygame
import time

async def test_tts_play():
    print("Testing edge-tts...")
    communicate = edge_tts.Communicate(
        "Yes, sir?", "en-GB-RyanNeural", rate="+5%", pitch="-2Hz"
    )
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    tmp.close()
    print("Saving...")
    await communicate.save(tmp.name)
    print("Playing...")
    try:
        pygame.mixer.init(frequency=24000)
        pygame.mixer.music.load(tmp.name)
        pygame.mixer.music.play()
        print("Waiting for playback...")
        while pygame.mixer.music.get_busy():
            time.sleep(0.05)
        print("Playback done!")
        pygame.mixer.music.unload()
    except Exception as e:
        print("Error during playback:", e)
    finally:
        os.remove(tmp.name)

asyncio.run(test_tts_play())
