import os
from pathlib import Path
from llama_cpp import Llama

models_dir = Path.home() / ".lmstudio" / "models" / "jarvis-fast"
phi3_path = None

for root, dirs, files in os.walk(models_dir):
    for f in files:
        if "phi-3-mini-4k-instruct-q4" in f.lower() and f.endswith(".gguf"):
            phi3_path = Path(root) / f
            break

if not phi3_path:
    print("Phi-3 model not found!")
    exit(1)

print(f"Loading {phi3_path}...")
try:
    llm = Llama(model_path=str(phi3_path), n_ctx=2048, verbose=True)
    print("Model loaded successfully. Testing chat completion...")
    
    response = llm.create_chat_completion(
        messages=[{"role": "user", "content": "What is the capital of India?"}],
        stream=False
    )
    print("Response:", response["choices"][0]["message"]["content"])
except Exception as e:
    import traceback
    traceback.print_exc()
