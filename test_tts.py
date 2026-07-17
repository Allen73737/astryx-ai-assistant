import asyncio
import edge_tts
import tempfile
import os

async def test_tts():
    print("Testing edge-tts...")
    try:
        communicate = edge_tts.Communicate(
            "Yes, sir?", "en-GB-RyanNeural", rate="+5%", pitch="-2Hz"
        )
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tmp.close()
        print(f"Saving to {tmp.name}...")
        await communicate.save(tmp.name)
        print("Save complete!")
        os.remove(tmp.name)
    except Exception as e:
        print("Error:", e)

asyncio.run(test_tts())
