import asyncio
import websockets
import json
import sys

async def test_ws():
    uri = "ws://127.0.0.1:8002/ws"
    print(f"Connecting to {uri}...", flush=True)
    try:
        async with websockets.connect(uri) as ws:
            print("Connected! Sending chat message...", flush=True)
            await ws.send(json.dumps({"type": "chat", "payload": {"message": "what is the capital of india?"}}))
            
            while True:
                response = await asyncio.wait_for(ws.recv(), timeout=20.0)
                data = json.loads(response)
                print(f"Received: {data['type']}", flush=True)
                if data['type'] == 'chat_response':
                    print(f"Content: {data['payload'].get('content', '')}", flush=True)
                    if data['payload'].get('done'):
                        break
                elif data['type'] == 'error':
                    print(f"Error: {data['payload']}", flush=True)
                    break
                elif data['type'] == 'model_swap':
                    print(f"Swap: {data['payload']}", flush=True)
    except Exception as e:
        print(f"Connection failed or timed out: {e}", flush=True)

asyncio.run(test_ws())
