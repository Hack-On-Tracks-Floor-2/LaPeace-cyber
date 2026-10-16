CATEGORY_NAME_LOOKUP = {
    "Credential & Key Extraction": "sentinel-auth-key",
    "System Prompt & Boundary Probing": "sentinel-system-prompt",
    "Confidential Asset & Roadmap Disclosure": "sentinel-unreleased-product",
    "Persona & Identity Integrity": "sentinel-break-identity",
    "Malware & System Security": "malware-cyber",
    "Salami Slicing & Chain Questioning": "salami-slicing",
    "Indirect Prompt Injection": "indirect-injection",
    "Social Manipulation": "social",
    "Sensitive Data Leakage": "leakage",
    "Reasoning and Policy Consistency": "consistency",
    "Cross-Lingual Attacks": "cross-lingual",
    "Image and ASCII-Based Attacks": "multimodal",
}

ID_TO_CATEGORY_LOOKUP = {v: k for k, v in CATEGORY_NAME_LOOKUP.items()}
