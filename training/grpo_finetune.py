"""
GRPO fine-tuning script for Qwen3-4B on fantasy football squad selection.

Designed to run on Colab A100 (free tier). Uses TRL's DPOTrainer with
GRPO-style preference learning.

Prerequisites (install in Colab):
    !pip install transformers trl peft accelerate bitsandbytes datasets

Usage:
    python training/grpo_finetune.py \
        --dataset training/data/grpo_dataset.jsonl \
        --output training/output/wc26-planner \
        --epochs 3 --batch_size 2
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_dataset(path: str) -> list[dict]:
    """Load GRPO dataset from JSONL."""
    data = []
    with open(path) as f:
        for line in f:
            data.append(json.loads(line.strip()))
    return data


def train(args):
    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, TaskType
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from trl import DPOConfig, DPOTrainer
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Install: pip install transformers trl peft accelerate bitsandbytes datasets")
        return

    print(f"Loading dataset from {args.dataset}...")
    raw_data = load_dataset(args.dataset)
    print(f"Loaded {len(raw_data)} samples.")

    # Convert to HF Dataset format
    hf_data = Dataset.from_list(raw_data)

    # Model config
    model_name = args.model or "Qwen/Qwen2.5-3B"
    print(f"Loading model: {model_name}")

    # 4-bit quantization for A100 memory efficiency
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
    )

    # LoRA config
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    )

    # DPO training config (GRPO-style preference learning)
    training_args = DPOConfig(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        learning_rate=5e-5,
        warmup_ratio=0.1,
        logging_steps=10,
        save_strategy="epoch",
        bf16=True,
        max_length=2048,
        max_prompt_length=1024,
        remove_unused_columns=False,
    )

    # Train
    trainer = DPOTrainer(
        model=model,
        args=training_args,
        train_dataset=hf_data,
        tokenizer=tokenizer,
        peft_config=peft_config,
    )

    print("Starting GRPO fine-tuning...")
    trainer.train()

    # Save
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)
    print(f"Model saved to {args.output}")


def main():
    parser = argparse.ArgumentParser(description="GRPO fine-tune Qwen for fantasy football")
    parser.add_argument("--dataset", type=str, default="training/data/grpo_dataset.jsonl")
    parser.add_argument("--model", type=str, default=None, help="Base model (default: Qwen/Qwen2.5-3B)")
    parser.add_argument("--output", type=str, default="training/output/wc26-planner")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=2)
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
