"""Tiny JSON-file persistence for settings, secrets, runs, attempts and findings."""

import copy
import json
import threading

from config import DATA_DIR, DEFAULT_SETTINGS, REPORTS_DIR, SECRETS_FILE, SETTINGS_FILE, STORE_FILE

_lock = threading.RLock()


def _read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return copy.deepcopy(default)


def _write(path, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _merge(base, patch):
    out = copy.deepcopy(base)
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


# ---------------------------------------------------------------- settings
def get_settings():
    with _lock:
        return _merge(DEFAULT_SETTINGS, _read(SETTINGS_FILE, {}))


def save_settings(patch):
    with _lock:
        merged = _merge(get_settings(), patch)
        _write(SETTINGS_FILE, merged)
        return merged


def get_secret(name):
    with _lock:
        return _read(SECRETS_FILE, {}).get(name) or ""


def set_secret(name, value):
    with _lock:
        secrets = _read(SECRETS_FILE, {})
        if value:
            secrets[name] = value
        else:
            secrets.pop(name, None)
        _write(SECRETS_FILE, secrets)


def secret_hint(name):
    v = get_secret(name)
    if not v:
        return ""
    return f"••••••••{v[-4:]}" if len(v) > 8 else "••••"


# ------------------------------------------------------------------- store
_EMPTY = {"runs": [], "attempts": [], "findings": [], "activity": [], "seq": {"run": 0, "atk": 0, "fnd": 0}}


def load():
    with _lock:
        return _merge(_EMPTY, _read(STORE_FILE, {}))


_state = None


def state():
    global _state
    with _lock:
        if _state is None:
            _state = load()
        return _state


def flush():
    with _lock:
        _write(STORE_FILE, state())


def next_id(kind, prefix, width):
    with _lock:
        s = state()
        s["seq"][kind] = s["seq"].get(kind, 0) + 1
        return f"{prefix}-{str(s['seq'][kind]).zfill(width)}"


def reset():
    """Clear runs/findings (keeps settings and secrets)."""
    global _state
    with _lock:
        _state = copy.deepcopy(_EMPTY)
        flush()
        if REPORTS_DIR.exists():
            for f in REPORTS_DIR.glob("*.md"):
                f.unlink()
