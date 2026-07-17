# -*- coding: utf-8 -*-
"""Full end-to-end test with generous timeout for CPU inference."""
import asyncio
import json
import websockets
import time
import sys

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8')

async def test():
    print("Connecting to backend...")
    async with websockets.connect("ws://127.0.0.1:8002/ws") as ws:
        status = await ws.recv()
        print(f"[OK] Connected (got: {json.loads(status)['type']})")
        
        msg = json.dumps({
            "type": "chat",
            "payload": {"message": "Hi"},
            "timestamp": int(time.time() * 1000),
            "id": "test-e2e"
        })
        await ws.send(msg)
        print("[OK] Sent 'Hi' -- waiting for response (CPU inference may take 30-90s)...")
        
        start = time.time()
        last_content = ""
        
        while True:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=180)
                data = json.loads(raw)
                mtype = data["type"]
                
                if mtype == "chat_response":
                    content = data["payload"].get("content", "")
                    done = data["payload"].get("done", False)
                    
                    if content != last_content:
                        elapsed = time.time() - start
                        print(f"  [{elapsed:.1f}s] {content}")
                        last_content = content
                    
                    if done:
                        elapsed = time.time() - start
                        print(f"\n{'='*50}")
                        print(f"[OK] COMPLETE in {elapsed:.1f}s")
                        print(f"  Response: {content}")
                        print(f"{'='*50}")
                        return True
                        
            except asyncio.TimeoutError:
                elapsed = time.time() - start
                print(f"\n[FAIL] TIMEOUT after {elapsed:.1f}s -- no response received")
                return False

    return False

success = asyncio.run(test())
exit(0 if success else 1)
