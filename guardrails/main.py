"""
guardrails/main.py  —  FastAPI :6006
Filtre input/output selon les scanner_params envoyés par l'Orchestrator.
Les paramètres (enabled, threshold, substrings…) viennent tous de la requête :
l'Orchestrator les lit depuis input_guardrail_params / output_guardrail_params
de la config Admin, et les pousse ici.
Aucun appel à d'autres services Python.
"""
import re
import sys
from pathlib import Path
from typing import Any, Optional

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from shared.config import get_settings
from shared.models import GuardrailRequest, GuardrailResponse

settings = get_settings()

app = FastAPI(title="Guardrails Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# ── Patterns fixes (non configurables) ───────────────────────────────────────
_PROMPT_INJECTION_PATTERNS = [
    "ignore previous instructions", "ignore les instructions",
    "oublie tes instructions",      "forget your instructions",
    "act as",   "agis comme",
    "jailbreak", "dan mode",        "do anything now",
    "you are now",                  "tu es maintenant",
]

_TOXIC_WORDS = [
    "idiot", "imbécile", "connard", "salaud",
    "moron", "asshole", "bastard",
]

_SECRET_PATTERNS = [
    r"(?i)(api[_\-]?key|secret|password|mot.?de.?passe)\s*[:=]\s*\S+",
    r"Bearer\s+[A-Za-z0-9\-._~+/]+=*",
    r"[A-Z0-9]{32,}",
]

_INVISIBLE_CHARS = frozenset([0x200B, 0x200C, 0x200D, 0xFEFF, 0x00AD, 0x2060])


# ── Scanners ──────────────────────────────────────────────────────────────────

def _scan_prompt_injection(text: str, params: dict) -> tuple[bool, Optional[str]]:
    if not params.get("enabled", False):
        return True, None
    tl = text.lower()
    for p in _PROMPT_INJECTION_PATTERNS:
        if p in tl:
            return False, f"[prompt_injection] Pattern détecté : '{p}'"
    return True, None


def _scan_ban_substrings(text: str, params: dict) -> tuple[bool, Optional[str]]:
    if not params.get("enabled", False):
        return True, None
    raw = params.get("substrings") or []
    subs = [s.strip() for s in raw.split(",")] if isinstance(raw, str) else list(raw)
    if not subs:
        return True, None
    case_sensitive = params.get("case_sensitive", False)
    contains_all   = params.get("contains_all", False)
    hay   = text if case_sensitive else text.lower()
    needles = subs if case_sensitive else [s.lower() for s in subs]
    found = (all if contains_all else any)(n in hay for n in needles)
    return (not found, "[ban_substrings] Sous-chaîne interdite détectée" if found else None)


def _scan_token_limit(text: str, params: dict) -> tuple[bool, Optional[str]]:
    if not params.get("enabled", False):
        return True, None
    limit       = int(params.get("limit", 1000))
    approx_toks = len(text) // 4
    if approx_toks > limit:
        return False, f"[token_limit] ~{approx_toks} tokens > limite {limit}"
    return True, None


def _scan_regex(text: str, params: dict) -> tuple[bool, Optional[str]]:
    if not params.get("enabled", False):
        return True, None
    raw = params.get("patterns") or []
    patterns    = [p.strip() for p in raw.split(",")] if isinstance(raw, str) else list(raw)
    match_type  = params.get("match_type", "any")
    results     = [bool(re.search(p, text, re.IGNORECASE)) for p in patterns if p]
    triggered   = (all if match_type == "all" else any)(results) if results else False
    return (not triggered, "[regex] Pattern interdit détecté" if triggered else None)


def _scan_invisible_text(text: str, params: dict) -> tuple[bool, Optional[str]]:
    if not params.get("enabled", False):
        return True, None
    hits = [c for c in text if ord(c) in _INVISIBLE_CHARS]
    if hits:
        return False, f"[invisible_text] {len(hits)} caractère(s) invisible(s)"
    return True, None


def _scan_sentiment(text: str, params: dict) -> tuple[bool, Optional[str]]:
    if not params.get("enabled", False):
        return True, None
    threshold = float(params.get("threshold", -0.5))
    neg_words = [
        "haine", "tuer", "détruire", "menacer", "attaque", "harceler",
        "hate",  "kill",  "destroy",  "threat",  "attack",  "harass",
    ]
    tl    = text.lower()
    count = sum(1 for w in neg_words if w in tl)
    score = -count / max(len(text.split()), 1)
    if score < threshold:
        return False, f"[sentiment] Score {score:.3f} < seuil {threshold}"
    return True, None


def _scan_secrets(text: str, params: dict) -> tuple[bool, Optional[str]]:
    if not params.get("enabled", False):
        return True, None
    for pat in _SECRET_PATTERNS:
        if re.search(pat, text):
            return False, "[secrets] Secret potentiel détecté"
    return True, None


def _scan_toxicity(text: str, params: dict) -> tuple[bool, Optional[str]]:
    if not params.get("enabled", False):
        return True, None
    threshold = float(params.get("threshold", 0.5))
    tl        = text.lower()
    hits      = sum(1 for w in _TOXIC_WORDS if w in tl)
    score     = min(hits / 3.0, 1.0)
    if score >= threshold:
        return False, f"[toxicity] Score {score:.2f} ≥ seuil {threshold}"
    return True, None


_SCANNERS: dict[str, Any] = {
    "prompt_injection": _scan_prompt_injection,
    "ban_substrings":   _scan_ban_substrings,
    "token_limit":      _scan_token_limit,
    "regex":            _scan_regex,
    "invisible_text":   _scan_invisible_text,
    "sentiment":        _scan_sentiment,
    "secrets":          _scan_secrets,
    "toxicity":         _scan_toxicity,
}

def _run_scanners(
    text: str,
    scanner_params: dict[str, dict],
) -> tuple[bool, Optional[str], Optional[str]]:
    """
    Exécute chaque scanner dont le nom est présent dans scanner_params.
    Les params viennent tous de la requête (poussés par l'Orchestrator depuis Admin).
    Retourne (is_safe, reason, triggered_scanner_name).
    """
    for name, fn in _SCANNERS.items():
        params = scanner_params.get(name, {})
        if not params:
            continue
        is_safe, reason = fn(text, params)
        if not is_safe:
            logger.warning("🛑 Scanner déclenché : {} — {}", name, reason)
            return False, reason, name
    return True, None, None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "guardrails"}


@app.post("/v1/guardrail/check", response_model=GuardrailResponse)
async def check_guardrail(request: GuardrailRequest):
    """
    scanner_params : dict fourni par l'Orchestrator depuis input/output_guardrail_params Admin.
    check_type     : "input" | "output" | "both"
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide.")
    try:
        is_safe, reason, scanner = _run_scanners(request.text, request.scanner_params)
        logger.info(
            "Guardrail [{}] → safe={} scanner={}",
            request.check_type, is_safe, scanner or "-",
        )
        logger.info(
    "scanner_params = {}",
    request.scanner_params
)
        return GuardrailResponse(
            is_safe=is_safe,
            original_text=request.text,
            filtered_text=request.text if is_safe else None,
            reason=reason,
            check_type=request.check_type,
            triggered_scanner=scanner,
        )
    except Exception as e:
        logger.error("❌ Erreur guardrail: {}", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/guardrail/input", response_model=GuardrailResponse)
async def check_input(request: GuardrailRequest):
    request.check_type = "input"
    return await check_guardrail(request)


@app.post("/v1/guardrail/output", response_model=GuardrailResponse)
async def check_output(request: GuardrailRequest):
    request.check_type = "output"
    return await check_guardrail(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.guardrail_input_port)