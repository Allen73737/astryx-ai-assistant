import os
from huggingface_hub import hf_hub_download

TARGET_DIR = r"C:\Users\allen\.lmstudio\models\jarvis-fast"
os.makedirs(TARGET_DIR, exist_ok=True)

models = [
    ("bartowski/microsoft_Phi-4-mini-instruct-GGUF", "microsoft_Phi-4-mini-instruct-Q4_K_M.gguf"),
    ("Qwen/Qwen2.5-3B-Instruct-GGUF", "qwen2.5-3b-instruct-q4_k_m.gguf"),
    ("unsloth/Qwen2.5-VL-7B-Instruct-GGUF", "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf")
]

for repo, filename in models:
    print(f"Downloading {filename} from {repo}...")
    try:
        path = hf_hub_download(repo_id=repo, filename=filename, local_dir=TARGET_DIR, local_dir_use_symlinks=False)
        print(f"Success: {path}")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")
        # Try alternate naming for Qwen2.5-VL
        if "Qwen2.5-VL" in repo:
            try:
                alt = "qwen2.5-vl-7b-instruct-q4_k_m.gguf"
                print(f"Trying alternate filename {alt}...")
                path = hf_hub_download(repo_id=repo, filename=alt, local_dir=TARGET_DIR, local_dir_use_symlinks=False)
                print(f"Success: {path}")
            except Exception as e2:
                print(f"Failed alternate: {e2}")

print("All downloads finished.")
