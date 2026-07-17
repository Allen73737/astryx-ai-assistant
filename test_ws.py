import asyncio
import websockets
import json

async def test_clap():
    uri = "ws://localhost:8002/ws"
    async with websockets.connect(uri) as websocket:
        print("Connected!")
        
        # Wait for status
        msg = await websocket.recv()
        print("Received:", msg)
        
        # Send clap
        clap_msg = json.dumps({
            "type": "clap_detected",
            "payload": {}
        })
        print("Sending clap...")
        await websocket.send(clap_msg)
        
        # Listen for responses
        for _ in range(3):
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5)
                print("Response:", response)
            except asyncio.TimeoutError:
                print("Timeout waiting for response.")
                break

asyncio.run(test_clap())
