"""
Export fine-tuned model to GGUF format for Ollama deployment.

After GRPO fine-tuning, this merges LoRA weights and converts to GGUF
for local inference via Ollama.

Prerequisites:
    pip install llama-cpp-python
    # OR use llama.cpp CLI: git clone https://github.com/ggerganov/llama.cpp

Usage:
    python training/export_gguf.py \
        --model training/output/wc26-planner \
        --output training/output/wc26-planner.gguf \
        --quantize q4_k_m
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def merge_lora(model_path: str, output_path: str):
    """Merge LoRA adapters back into base model."""
    try:
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch
    except ImportError:
        print("Install: pip install transformers peft torch")
        sys.exit(1)

    print(f"Loading base model + LoRA from {model_path}...")
    # The adapter_config.json tells us the base model
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.float16,
        device_map="cpu",
    )

    tokenizer = AutoTokenizer.from_pretrained(model_path)

    merged_path = output_path + "_merged"
    print(f"Saving merged model to {merged_path}...")
    model.save_pretrained(merged_path)
    tokenizer.save_pretrained(merged_path)
    return merged_path


def convert_to_gguf(model_path: str, output_path: str, quantize: str = "q4_k_m"):
    """Convert HF model to GGUF using llama.cpp's convert script."""
    # Check if llama.cpp convert script exists
    convert_script = Path.home() / "llama.cpp" / "convert_hf_to_gguf.py"

    if not convert_script.exists():
        print("llama.cpp not found at ~/llama.cpp")
        print("Clone it: git clone https://github.com/ggerganov/llama.cpp ~/llama.cpp")
        print("\nAlternative: use Ollama directly with the merged HF model:")
        print(f"  ollama create wc26-planner -f training/Modelfile")
        return

    print(f"Converting to GGUF (quantization: {quantize})...")
    subprocess.run(
        [sys.executable, str(convert_script), model_path, "--outfile", output_path,
         "--outtype", quantize],
        check=True,
    )
    print(f"GGUF saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Export to GGUF for Ollama")
    parser.add_argument("--model", type=str, default="training/output/wc26-planner")
    parser.add_argument("--output", type=str, default="training/output/wc26-planner.gguf")
    parser.add_argument("--quantize", type=str, default="q4_k_m",
                        choices=["q4_0", "q4_k_m", "q5_k_m", "q8_0", "f16"])
    args = parser.parse_args()

    merged_path = merge_lora(args.model, args.output)
    convert_to_gguf(merged_path, args.output, args.quantize)


if __name__ == "__main__":
    main()
