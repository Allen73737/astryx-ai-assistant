import os
from pathlib import Path
from huggingface_hub import hf_hub_download

TARGET_DIR = Path.home() / ".lmstudio" / "models" / "jarvis-fast"
os.makedirs(TARGET_DIR, exist_ok=True)

MODELS = [
    {
        "repo_id": "bartowski/Llama-3.2-1B-Instruct-GGUF",
        "filename": "Llama-3.2-1B-Instruct-Q4_K_M.gguf"
    },
    {
        "repo_id": "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
        "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf"
    },
    {
        "repo_id": "microsoft/Phi-3-mini-4k-instruct-gguf",
        "filename": "Phi-3-mini-4k-instruct-q4.gguf"
    },
    {
        "repo_id": "nomic-ai/nomic-embed-text-v1.5-GGUF",
        "filename": "nomic-embed-text-v1.5.Q4_K_M.gguf"
    }
]

def main():
    print(f"Downloading {len(MODELS)} ultra-fast local models to {TARGET_DIR}...")
    for model in MODELS:
        print(f"\n--- Downloading {model['filename']} ---")
        try:
            downloaded_path = hf_hub_download(
                repo_id=model["repo_id"],
                filename=model["filename"],
                local_dir=str(TARGET_DIR),
                local_dir_use_symlinks=False
            )
            print(f"Successfully downloaded to: {downloaded_path}")
        except Exception as e:
            print(f"Failed to download {model['filename']}: {e}")

if __name__ == "__main__":
    main()
