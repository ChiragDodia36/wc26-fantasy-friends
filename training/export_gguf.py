"""
Export fine-tuned Qwen3-0.6B LoRA adapter to GGUF for on-device inference via llama.rn.

Steps:
  1. Merge LoRA weights into the base Qwen3-0.6B model
  2. Save merged HuggingFace model
  3. Convert to GGUF using llama.cpp's convert_hf_to_gguf.py
  4. Quantize to Q4_K_M (matches the original model format used by the app)
  5. Upload to HuggingFace Hub (optional)

Prerequisites:
    pip install transformers peft torch huggingface_hub
    git clone https://github.com/ggerganov/llama.cpp ~/llama.cpp
    cd ~/llama.cpp && pip install -r requirements.txt

Usage:
    python training/export_gguf.py \\
        --adapter training/output/wc26-qwen3 \\
        --output training/output/wc26-qwen3-Q4_K_M.gguf

After export, update modelManager.ts MODEL_URL to point to the new GGUF on HuggingFace Hub.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

BASE_MODEL = "Qwen/Qwen3-0.6B"


def merge_lora(adapter_path: str, merged_path: str) -> str:
    """Merge LoRA adapter into base model and save as full HF model."""
    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        print("Install: pip install transformers peft torch")
        sys.exit(1)

    print(f"Loading base model: {BASE_MODEL}")
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float16,
        device_map="cpu",
        trust_remote_code=True,
    )
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)

    print(f"Loading LoRA adapter from: {adapter_path}")
    model = PeftModel.from_pretrained(model, adapter_path)

    print("Merging LoRA weights into base model...")
    model = model.merge_and_unload()

    print(f"Saving merged model to: {merged_path}")
    model.save_pretrained(merged_path, safe_serialization=True)
    tokenizer.save_pretrained(merged_path)

    return merged_path


def convert_to_gguf(merged_path: str, output_path: str, quantize: str = "q4_k_m"):
    """Convert merged HF model to GGUF using llama.cpp."""
    llama_cpp = Path.home() / "llama.cpp"
    convert_script = llama_cpp / "convert_hf_to_gguf.py"
    quantize_bin = llama_cpp / "build" / "bin" / "llama-quantize"

    if not convert_script.exists():
        print("\nllama.cpp not found. Clone it first:")
        print("  git clone https://github.com/ggerganov/llama.cpp ~/llama.cpp")
        print("  cd ~/llama.cpp && cmake -B build && cmake --build build --config Release -j")
        sys.exit(1)

    # Step 1: Convert to f16 GGUF first
    f16_path = output_path.replace(".gguf", "-f16.gguf")
    print(f"Converting to f16 GGUF: {f16_path}")
    subprocess.run(
        [sys.executable, str(convert_script), merged_path,
         "--outfile", f16_path, "--outtype", "f16"],
        check=True,
    )

    # Step 2: Quantize to Q4_K_M
    if quantize_bin.exists():
        print(f"Quantizing to {quantize.upper()}: {output_path}")
        subprocess.run(
            [str(quantize_bin), f16_path, output_path, quantize],
            check=True,
        )
        print(f"Removing intermediate f16 file...")
        Path(f16_path).unlink(missing_ok=True)
    else:
        print(f"llama-quantize not found — skipping quantization. f16 GGUF at: {f16_path}")
        print("Build llama.cpp: cd ~/llama.cpp && cmake -B build && cmake --build build -j")
        output_path = f16_path

    print(f"\nGGUF ready: {output_path}")
    return output_path


def upload_to_hub(gguf_path: str, repo_id: str):
    """Upload GGUF to HuggingFace Hub."""
    try:
        from huggingface_hub import HfApi
    except ImportError:
        print("Install: pip install huggingface_hub")
        return

    api = HfApi()
    filename = Path(gguf_path).name
    print(f"Uploading {filename} to {repo_id}...")
    api.upload_file(
        path_or_fileobj=gguf_path,
        path_in_repo=filename,
        repo_id=repo_id,
        repo_type="model",
    )
    url = f"https://huggingface.co/{repo_id}/resolve/main/{filename}"
    print(f"Uploaded! Update modelManager.ts MODEL_URL to:\n  {url}")


def main():
    parser = argparse.ArgumentParser(description="Export Qwen3 LoRA adapter to GGUF for llama.rn")
    parser.add_argument("--adapter", type=str, default="training/output/wc26-qwen3",
                        help="Path to LoRA adapter (output of grpo_finetune.py)")
    parser.add_argument("--merged", type=str, default="training/output/wc26-qwen3-merged",
                        help="Where to save the merged HF model")
    parser.add_argument("--output", type=str, default="training/output/wc26-qwen3-Q4_K_M.gguf",
                        help="Output GGUF file path")
    parser.add_argument("--quantize", type=str, default="q4_k_m",
                        choices=["q4_0", "q4_k_m", "q5_k_m", "q8_0", "f16"],
                        help="Quantization type (default: q4_k_m, same as base model)")
    parser.add_argument("--upload", type=str, default=None,
                        help="HuggingFace repo ID to upload GGUF (e.g. cpdodia/wc26-qwen3-gguf)")
    args = parser.parse_args()

    merged = merge_lora(args.adapter, args.merged)
    gguf_path = convert_to_gguf(merged, args.output, args.quantize)

    if args.upload:
        upload_to_hub(gguf_path, args.upload)
    else:
        print(f"\nTo deploy: upload {gguf_path} to HuggingFace Hub, then update")
        print("apps/mobile/services/modelManager.ts MODEL_URL to the new file URL.")
        print("\nOr run with --upload <your-hf-username/repo-name> to do it automatically.")


if __name__ == "__main__":
    main()
