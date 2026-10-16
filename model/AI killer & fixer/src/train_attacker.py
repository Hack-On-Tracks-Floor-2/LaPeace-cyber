#!/usr/bin/env python3
"""
train_attacker.py

Fine-tunes a test-prompt generator with QLoRA on data/processed/attacker_sft.jsonl
using plain HuggingFace transformers Trainer + peft (no trl).

Outputs:
  - LoRA adapter saved to models/attacker_lora/
  - Metrics log saved to results/attacker_train_log.csv
  - Training curve plot saved to results/attacker_training_curves.png
"""

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import torch
from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training
from torch.utils.data import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    DataCollatorForSeq2Seq,
    EarlyStoppingCallback,
    Trainer,
    TrainerCallback,
    TrainingArguments,
    set_seed,
)


def truncate_prompt(text: str, max_chars: int = 150) -> str:
    s = str(text).replace("\n", " ")
    if len(s) > max_chars:
        return s[:max_chars - 3] + "..."
    return s


class AttackerSFTDataset(Dataset):
    """PyTorch Dataset that formats messages and masks prompt tokens for loss calculation."""
    def __init__(self, records, tokenizer, max_length=512):
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.features = []

        for item in records:
            messages = item["messages"]
            # Messages: [system, user, assistant]
            full_prompt = self.tokenizer.apply_chat_template(messages, tokenize=False)
            prompt_only = self.tokenizer.apply_chat_template(messages[:-1], tokenize=False, add_generation_prompt=True)

            full_enc = self.tokenizer(
                full_prompt,
                truncation=True,
                max_length=self.max_length,
                add_special_tokens=False
            )
            prompt_enc = self.tokenizer(
                prompt_only,
                truncation=True,
                max_length=self.max_length,
                add_special_tokens=False
            )

            input_ids = full_enc["input_ids"]
            attention_mask = full_enc["attention_mask"]
            prompt_len = min(len(prompt_enc["input_ids"]), len(input_ids))

            # Mask out system + user + assistant header tokens with -100
            labels = [-100] * prompt_len + input_ids[prompt_len:]

            self.features.append({
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "labels": labels
            })

    def __len__(self):
        return len(self.features)

    def __getitem__(self, idx):
        return self.features[idx]


class MetricsLoggerCallback(TrainerCallback):
    """Logs train and eval loss history to CSV."""
    def __init__(self, log_path="results/attacker_train_log.csv"):
        self.log_path = log_path
        self.history = []

    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs is None:
            return
        entry = {
            "step": state.global_step,
            "epoch": logs.get("epoch", None),
            "loss": logs.get("loss", None),
            "eval_loss": logs.get("eval_loss", None),
            "learning_rate": logs.get("learning_rate", None),
        }
        self.history.append(entry)

    def on_train_end(self, args, state, control, **kwargs):
        os.makedirs(os.path.dirname(self.log_path), exist_ok=True)
        df_logs = pd.DataFrame(self.history)
        df_logs.to_csv(self.log_path, index=False)
        print(f"Logged training metrics to {self.log_path}")


def plot_training_curves(log_path, output_png):
    """Plots training and eval loss curves."""
    if not os.path.exists(log_path):
        return
    df = pd.read_csv(log_path)
    train_points = df[df["loss"].notna()]
    eval_points = df[df["eval_loss"].notna()]

    plt.figure(figsize=(8, 5))
    if not train_points.empty:
        plt.plot(train_points["step"], train_points["loss"], label="Train Loss", color="royalblue")
    if not eval_points.empty:
        plt.plot(eval_points["step"], eval_points["eval_loss"], label="Validation Loss", color="crimson", marker="o")

    plt.xlabel("Step")
    plt.ylabel("Loss")
    plt.title("Attacker SFT QLoRA Training Curves")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.6)
    plt.tight_layout()
    plt.savefig(output_png, dpi=150)
    plt.close()
    print(f"Saved training curve plot to {output_png}")


def get_default_model(vram_gb: float) -> str:
    """Selects default model based on available VRAM."""
    if vram_gb < 6.0:
        # Card with ~4 GB VRAM
        return "Qwen/Qwen2.5-0.5B-Instruct"
    elif vram_gb >= 8.0:
        return "Qwen/Qwen2.5-1.5B-Instruct"
    else:
        return "Qwen/Qwen2.5-1.5B-Instruct"


def load_dataset_records(path: str, sample_n: int = None, seed: int = 42):
    train_records, val_records, test_records = [], [], []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            item = json.loads(line)
            split = item.get("split", "train")
            if split == "train":
                train_records.append(item)
            elif split == "val":
                val_records.append(item)
            elif split == "test":
                test_records.append(item)

    if sample_n and sample_n > 0:
        import random
        random.seed(seed)
        # Allocate sample proportionately across splits
        total_raw = len(train_records) + len(val_records) + len(test_records)
        train_n = max(1, int(sample_n * (len(train_records) / total_raw)))
        val_n = max(1, int(sample_n * (len(val_records) / total_raw)))
        random.shuffle(train_records)
        random.shuffle(val_records)
        train_records = train_records[:train_n]
        val_records = val_records[:val_n]

    return train_records, val_records, test_records


def build_trainer(model, tokenizer, train_dataset, val_dataset, args, max_length, output_dir):
    data_collator = DataCollatorForSeq2Seq(
        tokenizer=tokenizer,
        pad_to_multiple_of=8,
        return_tensors="pt",
        padding=True
    )

    eval_steps = min(100, max(1, args.max_steps // 2)) if (args.max_steps and args.max_steps < 100) else 100
    save_steps = eval_steps

    if args.max_steps is not None and args.max_steps > 0:
        total_steps = args.max_steps
    else:
        steps_per_epoch = math.ceil(len(train_dataset) / 16)
        total_steps = steps_per_epoch * args.epochs
    warmup_steps = max(1, int(total_steps * 0.03))

    training_args = TrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=16,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_steps=warmup_steps,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps if args.max_steps is not None else -1,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        seed=42,
        eval_strategy="steps",
        eval_steps=eval_steps,
        save_strategy="steps",
        save_steps=save_steps,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        save_total_limit=2,
        logging_steps=max(1, eval_steps // 2),
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        report_to="none",
        dataloader_num_workers=0,
    )

    callbacks = [
        EarlyStoppingCallback(early_stopping_patience=3),
        MetricsLoggerCallback("results/attacker_train_log.csv")
    ]

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
        callbacks=callbacks,
    )
    return trainer


def main():
    parser = argparse.ArgumentParser(description="QLoRA fine-tuning for attacker prompt generator")
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-1.5B-Instruct", help="Base model name or path")
    parser.add_argument("--sample", type=int, default=None, help="Sample N rows total for training/eval")
    parser.add_argument("--max_steps", type=int, default=None, help="Max training steps")
    parser.add_argument("--epochs", type=int, default=2, help="Number of epochs")
    parser.add_argument("--max_length", type=int, default=512, help="Maximum sequence length")
    args = parser.parse_args()

    # GPU Detection
    set_seed(42)
    device_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    vram_gb = (torch.cuda.get_device_properties(0).total_memory / (1024**3)) if torch.cuda.is_available() else 0.0

    print("=" * 60)
    print(f"Detected GPU: {device_name} | VRAM: {vram_gb:.2f} GB")
    print(f"BF16 Supported: {torch.cuda.is_bf16_supported()}")
    if vram_gb < 6.0:
        print("Note: 4 GB card detected. Qwen2.5-1.5B-Instruct will run with 4-bit NF4 QLoRA; Qwen2.5-0.5B-Instruct is also supported via --model.")
    elif vram_gb >= 8.0:
        print("Note: >= 8 GB VRAM detected. Qwen/Qwen2.5-3B-Instruct is also supported via --model.")
    print("=" * 60)

    model_name = args.model
    print(f"Using base model: {model_name}")

    # Tokenizer
    print(f"Loading tokenizer for {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id

    # Quantization Config (4-bit NF4 + double quant)
    compute_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    def load_model():
        print(f"Loading base model {model_name} in 4-bit NF4...")
        base_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            quantization_config=bnb_config,
            device_map="auto",
        )
        base_model = prepare_model_for_kbit_training(base_model)

        lora_config = LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            target_modules="all-linear",
            task_type=TaskType.CAUSAL_LM,
        )
        peft_model = get_peft_model(base_model, lora_config)
        peft_model.print_trainable_parameters()
        return peft_model

    model = load_model()

    # Load SFT dataset records
    data_path = "data/processed/attacker_sft.jsonl"
    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found. Run src/build_attacker_data.py first.")
        sys.exit(1)

    print(f"Loading SFT data from {data_path} (sample={args.sample})...")
    train_records, val_records, test_records = load_dataset_records(data_path, sample_n=args.sample, seed=42)
    print(f"Loaded: train={len(train_records)}, val={len(val_records)}, test={len(test_records)}")

    # Function to prepare datasets and run training with OOM fallback
    current_max_length = args.max_length
    retry_done = False

    while True:
        print(f"\nBuilding tokenized datasets with max_length={current_max_length}...")
        train_dataset = AttackerSFTDataset(train_records, tokenizer, max_length=current_max_length)
        val_dataset = AttackerSFTDataset(val_records, tokenizer, max_length=current_max_length)

        # Print Token Masking Verification Example
        if len(train_dataset) > 0:
            sample_feat = train_dataset[0]
            masked_ids = [inp for inp, lbl in zip(sample_feat["input_ids"], sample_feat["labels"]) if lbl == -100]
            unmasked_ids = [lbl for lbl in sample_feat["labels"] if lbl != -100]
            masked_text = tokenizer.decode(masked_ids, skip_special_tokens=False)
            unmasked_text = tokenizer.decode(unmasked_ids, skip_special_tokens=False)

            print("\n" + "=" * 60)
            print("TOKEN MASKING VERIFICATION EXAMPLE")
            print("=" * 60)
            print("Masked Tokens (Label = -100, System + User prompt, NO loss):")
            print("  " + truncate_prompt(masked_text, max_chars=150))
            print("Unmasked Tokens (Label != -100, Assistant response, LOSS COMPUTED):")
            print("  " + truncate_prompt(unmasked_text, max_chars=150))
            print(f"Total tokens: {len(sample_feat['input_ids'])} (Masked: {len(masked_ids)}, Loss: {len(unmasked_ids)})")
            print("=" * 60 + "\n")

        trainer = build_trainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=train_dataset,
            val_dataset=val_dataset,
            args=args,
            max_length=current_max_length,
            output_dir="models/attacker_checkpoints"
        )

        torch.cuda.reset_peak_memory_stats()
        start_time = time.time()

        try:
            print("Starting training...")
            train_result = trainer.train()
            total_train_time = time.time() - start_time
            peak_vram_gb = torch.cuda.max_memory_allocated() / (1024**3)
            
            # Print performance metrics
            global_steps = trainer.state.global_step
            sec_per_step = total_train_time / max(1, global_steps)
            total_tokens = sum(len(x["input_ids"]) for x in train_dataset)
            tok_per_sec = (total_tokens * args.epochs) / max(0.001, total_train_time)

            print("\n" + "=" * 60)
            print("TRAINING RUN SUMMARY")
            print("=" * 60)
            print(f"Completed Steps:      {global_steps}")
            print(f"Total Time:           {total_train_time:.2f} s")
            print(f"Seconds per Step:     {sec_per_step:.2f} s/step")
            print(f"Estimated Tokens/sec: {tok_per_sec:.2f} tokens/s")
            print(f"Peak VRAM:            {peak_vram_gb:.2f} GB / {vram_gb:.2f} GB")

            # Extrapolate full run time if this was a smoke test
            if args.max_steps and args.max_steps < 100:
                # Full run has ~5049 train items, batch size 1, grad accum 16 -> 5049 / 16 = 315 steps per epoch * 2 epochs = 630 steps
                full_steps = math.ceil((5049 * args.epochs) / 16)
                est_full_seconds = full_steps * sec_per_step
                print(f"Estimated Full Run:   ~{full_steps} steps | ~{est_full_seconds / 60:.1f} minutes ({est_full_seconds / 3600:.2f} hours)")
            print("=" * 60)

            # Save best model adapter & tokenizer
            save_path = "models/attacker_lora"
            os.makedirs(save_path, exist_ok=True)
            print(f"Saving best LoRA adapter and tokenizer to {save_path}...")
            trainer.model.save_pretrained(save_path)
            tokenizer.save_pretrained(save_path)

            # Plot curves
            plot_training_curves("results/attacker_train_log.csv", "results/attacker_training_curves.png")
            break

        except (torch.cuda.OutOfMemoryError, RuntimeError) as e:
            if "out of memory" in str(e).lower() and not retry_done:
                print("\n" + "!" * 60)
                print("CUDA OutOfMemory detected! Halving max_length and retrying once...")
                print("!" * 60 + "\n")
                torch.cuda.empty_cache()
                current_max_length = current_max_length // 2
                retry_done = True
                # Reload model cleanly
                del trainer, model
                torch.cuda.empty_cache()
                model = load_model()
            else:
                raise e


if __name__ == "__main__":
    main()
