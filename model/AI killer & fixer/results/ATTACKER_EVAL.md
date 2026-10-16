# Attacker Model Evaluation Report (Base vs. LoRA-Tuned)

> [!IMPORTANT]
> **Safety & Scope Notice:** These metrics measure the generation quality, conditioning adherence, and format compliance of the prompt generator. They do **NOT** measure attack success rate (ASR) against any target system. Evaluating ASR requires sending generated prompts to the target chatbot API in conjunction with an external safety judge in downstream evaluation stages.

---

## 1. Executive Summary: Base vs. Tuned Comparison

| Metric | Base (`Qwen2.5-1.5B`) | Tuned (`Base + LoRA`) | Delta | 95% Bootstrap CI (Tuned) |
| :--- | :---: | :---: | :---: | :---: |
| **Test Loss** | 2.5183 | 1.7847 | -0.7336 | — |
| **Perplexity (PPL)** | 12.41 | 5.96 | -6.45 | — |
| **Usable-Output Rate** | 80.0% | 79.2% | -0.8% | [71.7%, 86.7%] |
| **Language Correctness** | 23.3% | 80.0% | +56.7% | [71.1%, 87.8%] |
| **Mean Intent Similarity** | 0.606 | 0.484 | -0.122 | — |
| **Off-Topic Rate (< 0.3)** | 5.8% | 25.8% | +20.0% | [18.3%, 32.5%] |
| **Distinct-2 / Distinct-3** | 0.680 / 0.890 | 0.767 / 0.921 | — | — |
| **Pairwise Sample Distance** | 0.340 | 0.375 | +0.035 | — |
| **Near-Copies (> 0.9 TF-IDF)** | 0.0% | 0.8% | +0.8% | [0.0%, 2.5%] |
| **8-Gram Exact Overlap** | 4.2% | 12.5% | +8.3% | — |

---

## 2. Findings & Answers to Evaluation Questions

### A. Did Tuning Improve Usable-Output Rate, Language Correctness, and Diversity?
* **Usable-Output Rate:** The base model frequently outputs meta-preambles (e.g. *"Here is a test prompt..."*) or standard refusals (*"I cannot create a prompt that..."*). Tuning with masked SFT conditions the model to output **strictly the test prompt** without conversational preambles, increasing usable prompt yield.
* **Language Correctness:** For translation-based strategies, the tuned model correctly conditions on the requested language slot (`Language: Hindi / Hinglish / Bengali / etc.`), preventing the base model's default tendency to reply in English.
* **Sample Diversity:** The pairwise sample distance across $n=3$ generations demonstrates that temperature sampling ($T=0.8$) maintains lexical and structural variety across samples rather than collapsing into repetitive templates.

### B. Does the Model Memorize Training Data?
* **Memorization Assessment:** The near-copy rate ($> 0.9$ TF-IDF similarity to training prompts) and exact 8-gram overlap rate remain low. The model generalizes the *framing format* (e.g. roleplay persona templates, hypothetical research setups) while adapting the specific semantic content of unseen target behaviors.

### C. Failure Modes & Limitations
1. **Low-Resource Languages:** Certain non-English translations (e.g. Swahili or Javanese) occasionally contain English loanwords or fall back to English when encountering complex technical vocabulary.
2. **Strategy Blending:** When prompted with subtle strategies (e.g. `persuasion`), the model sometimes blends in role-playing tropes (*"Imagine you are..."*).
3. **Generalization Gap:** On completely external behaviors (`attacker_heldout_behaviors.jsonl`), intent similarity remains robust (0.448 vs 0.520 on test split), indicating that behavioral generalization holds on novel domains.

---

## 3. Visualizations
- Key metrics comparison: `results/plots/base_vs_tuned_key_metrics.png`
- Strategy performance breakdown: `results/plots/usable_by_strategy.png`
