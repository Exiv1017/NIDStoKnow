"""Feature extraction utilities for anomaly (Isolation Forest) scoring.

Lightweight, deterministic feature set. Keep this small and stable so that
model versions remain comparable. If you add/change features, retrain and
increment model version hash.
"""
from __future__ import annotations
import math
import re
from typing import Dict, List, Tuple

SUSPICIOUS_KEYWORDS = [
    "nc", "netcat", "ncat", "wget", "curl", "base64", "ssh", "scp",
    "chmod", "chown", "/etc/passwd", "shadow", "sudo", "tar", "openssl"
]

SPECIAL_CHARS = set("|&;><")


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    length = len(s)
    ent = 0.0
    for count in freq.values():
        p = count / length
        ent -= p * math.log2(p)
    return ent


def extract_features(command: str) -> Dict[str, float]:
    """Extract a stable ordered dict (in insertion order) of numeric features.

    All features scaled or left raw; scaling/normalization handled downstream if needed.
    """
    cmd = command or ""
    command_length = len(cmd)
    tokens = cmd.split()
    arg_count = max(0, len(tokens) - 1)
    special_chars_count = sum(1 for c in cmd if c in SPECIAL_CHARS)
    path_separators_count = cmd.count('/')
    digits = sum(1 for c in cmd if c.isdigit())
    digit_ratio = digits / command_length if command_length else 0.0
    entropy = shannon_entropy(cmd)
    uppercase = sum(1 for c in cmd if c.isupper())
    uppercase_ratio = uppercase / command_length if command_length else 0.0
    suspicious_keyword_flag = 1.0 if any(k in cmd for k in SUSPICIOUS_KEYWORDS) else 0.0

    # Ordered insertion (Python 3.7+ dict preserves order)
    return {
        "command_length": float(command_length),
        "arg_count": float(arg_count),
        "special_chars_count": float(special_chars_count),
        "path_separators_count": float(path_separators_count),
        "digit_ratio": digit_ratio,
        "entropy": entropy,
        "uppercase_ratio": uppercase_ratio,
        "suspicious_keyword_flag": suspicious_keyword_flag,
    }


def feature_vector(command: str) -> Tuple[List[str], List[float]]:
    fdict = extract_features(command)
    return list(fdict.keys()), list(fdict.values())


__all__ = ["extract_features", "feature_vector", "SUSPICIOUS_KEYWORDS"]
