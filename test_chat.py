import asyncio
import websockets
import json
import logging
logging.basicConfig(level=logging.DEBUG)

async def test_chat():
    try:
        async with websockets.connect("ws://127.0.0.1:8002/ws") as ws:
            # wait for status
            print("Received:", await ws.recv())
            
            await ws.send(json.dumps({
                "type": "chat",
                "payload": {"message": "hello"}
            }))
            print("Chat sent! Waiting for response...")
            while True:
                msg = await ws.recv()
                print("Received:", msg)
                data = json.loads(msg)
                if data.get("type") == "chat_response" and data.get("payload", {}).get("done"):
                    print("Done!")
                    break
    except Exception as e:
        print("Error:", e)

asyncio.run(test_chat())
