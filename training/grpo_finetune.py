"""
DPO fine-tuning script for Qwen3-0.6B on fantasy football transfer suggestions.

Uses TRL's DPOTrainer with LoRA — designed to run on Google Colab T4/A100 (free tier).
The dataset format matches synthetic_dataset.py output: (prompt, chosen, rejected) triples
where prompt uses Qwen3's chat template and chosen responses include <think> traces.

Prerequisites (run in Colab first):
    !pip install -q transformers trl peft accelerate bitsandbytes datasets

Usage:
    python training/grpo_finetune.py \\
        --dataset training/data/grpo_dataset.jsonl \\
        --output training/output/wc26-qwen3 \\
        --epochs 3

Colab quickstart:
    1. Upload this file + grpo_dataset.jsonl to Colab
    2. Runtime → Change runtime type → T4 GPU
    3. Run the pip install cell, then: !python grpo_finetune.py --dataset grpo_dataset.jsonl
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

BASE_MODEL = "Qwen/Qwen3-0.6B"  # matches the on-device GGUF


def load_dataset(path: str) -> list[dict]:
    data = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return data


def train(args):
    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, TaskType, get_peft_model
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from trl import DPOConfig, DPOTrainer
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Run: pip install transformers trl peft accelerate bitsandbytes datasets")
        return

    print(f"Loading dataset from {args.dataset}...")
    raw_data = load_dataset(args.dataset)
    print(f"Loaded {len(raw_data)} samples.")

    hf_data = Dataset.from_list(raw_data)

    model_name = args.model or BASE_MODEL
    print(f"Loading model: {model_name}")

    # 4-bit quant for T4 (15GB VRAM) — works for 0.6B easily
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "left"  # required for decoder-only causal LM with DPO

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
    )
    model.config.use_cache = False  # required for gradient checkpointing

    # LoRA — target all attention projections for Qwen3
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        bias="none",
    )

    training_args = DPOConfig(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=2,
        learning_rate=5e-5,
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        logging_steps=20,
        save_strategy="epoch",
        bf16=True,
        max_length=2048,
        max_prompt_length=1024,
        remove_unused_columns=False,
        beta=0.1,  # DPO temperature — controls how strongly chosen is preferred
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
    )

    trainer = DPOTrainer(
        model=model,
        ref_model=None,  # use implicit reference (memory efficient)
        args=training_args,
        train_dataset=hf_data,
        tokenizer=tokenizer,
        peft_config=peft_config,
    )

    print("Starting DPO fine-tuning...")
    trainer.train()

    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)
    print(f"Model + LoRA adapter saved to {args.output}")
    print(f"\nNext step: python training/export_gguf.py --model {args.output}")


def main():
    parser = argparse.ArgumentParser(description="DPO fine-tune Qwen3-0.6B for fantasy football transfers")
    parser.add_argument("--dataset", type=str, default="training/data/grpo_dataset.jsonl")
    parser.add_argument("--model", type=str, default=None, help=f"Base model (default: {BASE_MODEL})")
    parser.add_argument("--output", type=str, default="training/output/wc26-qwen3")
    parser.add_argument("--epochs", type=int, default=3)
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
