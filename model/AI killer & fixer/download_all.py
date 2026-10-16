import os
import pandas as pd

os.makedirs("data/raw", exist_ok=True)
B = "hf://datasets/"

files = {
    "harmfulqa":      (B + "declare-lab/HarmfulQA/data_for_hub.json", "json"),
    "wild_train":     (B + "allenai/wildjailbreak/train/train.tsv", "tsv"),
    "wild_eval":      (B + "allenai/wildjailbreak/eval/eval.tsv", "tsv"),
    "jbv_mini":       (B + "JailbreakV-28K/JailBreakV-28k/JailBreakV_28K/mini_JailBreakV_28K.csv", "csv"),
    "jbv_redteam2k":  (B + "JailbreakV-28K/JailBreakV-28k/JailBreakV_28K/RedTeam_2K.csv", "csv"),
    "multijail":      (B + "DAMO-NLP-SG/MultiJail/MultiJail.csv", "csv"),
    "jbb_harmful":    (B + "JailbreakBench/JBB-Behaviors/data/harmful-behaviors.csv", "csv"),
    "jbb_benign":     (B + "JailbreakBench/JBB-Behaviors/data/benign-behaviors.csv", "csv"),
    "jbb_judge":      (B + "JailbreakBench/JBB-Behaviors/data/judge-comparison.csv", "csv"),
    "jailbreak_prompts_1": (B + "Simsonsun/JailbreakPrompts/data/Dataset1/train.csv", "csv"),
    "jailbreak_prompts_2": (B + "Simsonsun/JailbreakPrompts/data/Dataset2/train.csv", "csv"),
    "mocha_1":        (B + "purpcode/mocha/data/mocha_1-00000-of-00001.parquet", "parquet"),
    "mocha_2":        (B + "purpcode/mocha/data/mocha_2-00000-of-00001.parquet", "parquet"),
}

for name, (path, kind) in files.items():
    out = f"data/raw/{name}.parquet"
    if os.path.exists(out):
        print(f"skip {name} (already downloaded)")
        continue
    try:
        if kind == "json":
            df = pd.read_json(path)
        elif kind == "tsv":
            df = pd.read_csv(path, sep="\t", keep_default_na=False, low_memory=False)
        elif kind == "parquet":
            df = pd.read_parquet(path)
        else:
            df = pd.read_csv(path)
        try:
            df.to_parquet(out)
        except Exception:
            df.astype(str).to_parquet(out)   # fallback for mixed-type columns
        print(f"OK   {name}: {df.shape}  columns={list(df.columns)[:8]}")
    except Exception as e:
        print(f"FAIL {name}: {type(e).__name__}: {str(e)[:200]}")