import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://127.0.0.1:8002/ws"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as ws:
            print("Connected! Sending chat message...")
            await ws.send(json.dumps({"type": "chat", "payload": {"message": "Hello Jarvis!"}}))
            
            while True:
                response = await asyncio.wait_for(ws.recv(), timeout=10.0)
                data = json.loads(response)
                print(f"Received: {data['type']}")
                if data['type'] == 'chat_response':
                    print(f"Content: {data['payload'].get('content', '')}")
                    if data['payload'].get('done'):
                        break
                elif data['type'] == 'error':
                    print(f"Error: {data['payload']}")
                    break
    except Exception as e:
        print(f"Connection failed or timed out: {e}")

asyncio.run(test_ws())
