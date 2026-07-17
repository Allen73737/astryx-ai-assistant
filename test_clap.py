import asyncio
import websockets
import json

async def send_clap():
    async with websockets.connect("ws://127.0.0.1:8002/ws") as ws:
        await ws.send(json.dumps({
            "type": "clap_detected",
            "payload": {}
        }))
        print("Clap sent!")
        while True:
            msg = await ws.recv()
            print("Received:", msg)

asyncio.run(send_clap())
