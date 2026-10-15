"""Target chatbot adapters. Every target exposes send(prompt) -> (reply, meta)."""

import json
import time

import httpx
import store


class TargetError(Exception):
    """Request failed — recorded as REQ-ERR, never scored as a violation."""


def _dig(obj, path):
    cur = obj
    for part in [p for p in path.split(".") if p]:
        if isinstance(cur, list):
            cur = cur[int(part)]
        elif isinstance(cur, dict):
            cur = cur[part]
        else:
            raise KeyError(part)
    return cur


class LocalTarget:
    """Stock Qwen2.5-1.5B-Instruct (adapter disabled) behind a system prompt."""

    def __init__(self, cfg):
        self.cfg = cfg

    def describe(self):
        return f"local:{self.cfg.get('name') or 'qwen2.5-1.5b-instruct'}"

    def send(self, prompt):
        from models import hub
        messages = []
        if self.cfg.get("systemPrompt"):
            messages.append({"role": "system", "content": self.cfg["systemPrompt"]})
        messages.append({"role": "user", "content": prompt})
        reply, meta = hub.chat_base(messages, max_new_tokens=int(self.cfg.get("maxTokens") or 256))
        return reply, {"latencyMs": int(meta["seconds"] * 1000), "tokens": meta["tokens"]}


class OpenAITarget:
    """OpenAI, Azure OpenAI, Anthropic, or OpenAI-compatible endpoints."""

    def __init__(self, cfg, secret_name="target_api_key"):
        self.cfg = cfg
        self.key = cfg.get("apiKey") or store.get_secret(secret_name)

    def describe(self):
        provider = self.cfg.get("provider") or "openai"
        return f"{provider}:{self.cfg.get('model')}@{self.cfg.get('endpoint')}"

    def _url(self):
        ep = (self.cfg.get("endpoint") or "").strip().rstrip("/")
        provider = (self.cfg.get("provider") or "").lower()

        if not ep:
            if "anthropic" in provider:
                return "https://api.anthropic.com/v1/messages"
            if "ollama" in provider:
                return "http://localhost:11434/v1/chat/completions"
            if "lm studio" in provider or "lmstudio" in provider:
                return "http://localhost:1234/v1/chat/completions"
            return "https://api.openai.com/v1/chat/completions"

        if "anthropic" in ep or "anthropic" in provider:
            return ep if ep.endswith("/messages") else ep + "/messages"

        # Local Ollama helper
        if ":11434" in ep and not ep.endswith("/chat/completions"):
            if ep.endswith("/v1"):
                return ep + "/chat/completions"
            return ep + "/v1/chat/completions"

        # Local LM Studio helper
        if ":1234" in ep and not ep.endswith("/chat/completions"):
            if ep.endswith("/v1"):
                return ep + "/chat/completions"
            return ep + "/v1/chat/completions"

        if ep.endswith("/v1"):
            return ep + "/chat/completions"

        return ep if ep.endswith("/chat/completions") else ep + "/chat/completions"

    def chat(self, messages, max_tokens=None, temperature=0.0):
        url = self._url()
        provider = (self.cfg.get("provider") or "").lower()
        is_anthropic = "anthropic" in url or "anthropic" in provider
        is_azure = "azure" in url or "azure" in provider

        headers = {"content-type": "application/json"}
        if is_anthropic:
            if self.key:
                headers["x-api-key"] = self.key
            headers["anthropic-version"] = "2023-06-01"
            system_prompt = None
            user_msgs = []
            for m in messages:
                if m.get("role") == "system":
                    system_prompt = m.get("content")
                else:
                    user_msgs.append({"role": m.get("role", "user"), "content": m.get("content")})
            body = {
                "model": self.cfg.get("model") or "claude-3-5-sonnet-20241022",
                "messages": user_msgs,
                "max_tokens": int(max_tokens or self.cfg.get("maxTokens") or 512),
                "temperature": temperature,
            }
            if system_prompt:
                body["system"] = system_prompt
        else:
            if is_azure:
                if self.key:
                    headers["api-key"] = self.key
            elif self.key:
                headers["authorization"] = f"Bearer {self.key}"

            body = {
                "model": self.cfg.get("model") or "gpt-4o",
                "messages": messages,
                "temperature": temperature,
            }
            token_limit = int(max_tokens or self.cfg.get("maxTokens") or 150)
            body["max_tokens"] = token_limit

        started = time.time()
        default_timeout = 120 if (":11434" in url or "ollama" in provider) else 60
        timeout = float(self.cfg.get("timeoutSec") or default_timeout)
        try:
            r = httpx.post(url, headers=headers, json=body, timeout=timeout)
        except httpx.HTTPError as e:
            raise TargetError(f"{type(e).__name__}: {e}") from e

        if r.status_code >= 400:
            raise TargetError(f"http={r.status_code} {r.text[:220]}")

        try:
            data = r.json()
            if is_anthropic:
                reply = data["content"][0]["text"]
            else:
                reply = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, ValueError) as e:
            raise TargetError(f"unexpected response shape: {r.text[:220]}") from e

        latency_ms = int((time.time() - started) * 1000)
        return reply.strip(), {"latencyMs": latency_ms, "http": r.status_code}

    def send(self, prompt):
        messages = []
        if self.cfg.get("systemPrompt"):
            messages.append({"role": "system", "content": self.cfg["systemPrompt"]})
        messages.append({"role": "user", "content": prompt})
        return self.chat(messages, max_tokens=self.cfg.get("maxTokens"))


class CustomHttpTarget:
    """Arbitrary JSON chatbot API: body template with {{message}}, dot-path to reply."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.key = cfg.get("apiKey") or store.get_secret("target_api_key")

    def describe(self):
        return f"custom:{self.cfg.get('endpoint')}"

    def send(self, prompt):
        url = self.cfg.get("endpoint")
        if not url:
            raise TargetError("endpoint not configured")
        template = self.cfg.get("requestTemplate") or '{"message": "{{message}}"}'
        escaped = json.dumps(prompt)[1:-1]
        try:
            body = json.loads(template.replace("{{message}}", escaped))
        except json.JSONDecodeError as e:
            raise TargetError(f"request template is not valid JSON: {e}") from e

        headers = {"content-type": "application/json"}
        if self.key:
            headers["authorization"] = f"Bearer {self.key}"

        started = time.time()
        try:
            r = httpx.post(url, headers=headers, json=body, timeout=float(self.cfg.get("timeoutSec") or 60))
        except httpx.HTTPError as e:
            raise TargetError(f"{type(e).__name__}: {e}") from e

        if r.status_code >= 400:
            raise TargetError(f"http={r.status_code} {r.text[:200]}")

        try:
            reply = _dig(r.json(), self.cfg.get("responsePath") or "reply")
        except (KeyError, IndexError, ValueError, TypeError) as e:
            raise TargetError(f"responsePath '{self.cfg.get('responsePath')}' not found in: {r.text[:200]}") from e

        return str(reply).strip(), {"latencyMs": int((time.time() - started) * 1000), "http": r.status_code}


def build_target(cfg):
    provider = (cfg.get("provider") or "").lower()
    kind = (cfg.get("type") or "").lower()

    if kind in ("in-memory", "qwen-local", "local-hub"):
        return LocalTarget(cfg)
    if "custom" in provider or "custom" in kind:
        return CustomHttpTarget(cfg)
    return OpenAITarget(cfg)
