import os
from pathlib import Path
from llama_cpp import Llama

models_dir = Path.home() / ".lmstudio" / "models" / "jarvis-fast"
model_path = None

for root, dirs, files in os.walk(models_dir):
    for f in files:
        if "llama-3.2" in f.lower() and f.endswith(".gguf"):
            model_path = Path(root) / f
            break

if not model_path:
    print("Model not found!")
    exit(1)

print(f"Loading {model_path}...")
try:
    llm = Llama(model_path=str(model_path), n_ctx=4096, verbose=True)
    print("Model loaded successfully. Testing chat completion...")
    
    response = llm.create_chat_completion(
        messages=[{"role": "user", "content": "Hello!"}],
        stream=False
    )
    print("Response:", response["choices"][0]["message"]["content"])
except Exception as e:
    import traceback
    traceback.print_exc()
