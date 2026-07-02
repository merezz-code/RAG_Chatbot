"""
reranks/main.py  —  FastAPI :6004
Reranking lexical des documents récupérés.
top_n vient de la requête Orchestrator (lu depuis Admin).
Aucun appel à d'autres services Python.
"""
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from shared.config import get_settings
from shared.models import RerankerRequest, RerankerResponse, RerankedDoc

settings = get_settings()

app = FastAPI(title="Reranker Service", version="2.0.1")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


# ── Tokenisation ──────────────────────────────────────────────────────────────
#
# BUG CORRIGÉ : l'ancienne tokenisation faisait `text.lower().split()`, qui
# coupe uniquement sur les espaces et NE RETIRE PAS la ponctuation collée.
# Conséquence concrète : la query "quelle est la date de ce ticket
# ETXADM-493?" produit le token "etxadm-493?" (avec le "?" collé), qui ne
# matche JAMAIS "etxadm-493" présent dans le document, même si l'info exacte
# y est. Le chunk pertinent recevait alors un overlap_score artificiellement
# bas et pouvait être exclu du top_n par le reranker -> réponse "je ne vois
# pas l'information" alors qu'elle existe bien dans la base.
#
# FIX : on tokenise via une regex qui isole les mots/identifiants
# alphanumériques (incluant les tirets internes, ex: "ETXADM-493",
# "500010204*" -> "500010204"), et qui ignore toute la ponctuation
# environnante (?, ., !, virgules, guillemets...).
ID_TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*")

# Un identifiant "fort" (type ticket Jira, n° de document) : au moins une
# lettre ET au moins un chiffre, avec ou sans tiret. Sert à donner un bonus
# de score quand un identifiant exact de la query est retrouvé tel quel dans
# le document (les codes/références sont souvent LA clé de la bonne réponse,
# bien plus que le reste du vocabulaire de la question).
STRONG_ID_PATTERN = re.compile(r"^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9-]+$")


def tokenize(text: str) -> set[str]:
    """Extrait les tokens alphanumériques (identifiants compris), sans la ponctuation collée."""
    return set(m.group(0).lower() for m in ID_TOKEN_PATTERN.finditer(text))


def strong_identifiers(tokens: set[str]) -> set[str]:
    """Sous-ensemble des tokens qui ressemblent à un identifiant fort (ex: ETXADM-493)."""
    return {t for t in tokens if STRONG_ID_PATTERN.match(t)}


# ── Reranking ─────────────────────────────────────────────────────────────────
def simple_rerank(request: RerankerRequest) -> list[RerankedDoc]:
    """
    Reranking par chevauchement de mots (word-overlap), avec bonus pour les
    identifiants exacts (tickets, n° de document, codes produits...).
    Remplaçable par un cross-encoder ou un vrai hybrid BM25+vecteur sans
    changer l'interface.
    top_n vient de la requête (fourni par Orchestrator depuis Admin).
    """
    query_words = tokenize(request.query)
    query_ids = strong_identifiers(query_words)

    scored: list[RerankedDoc] = []

    for doc in request.documents:
        doc_words = tokenize(doc.text)
        overlap = len(query_words & doc_words)
        base_score = overlap / (len(query_words) + 1)

        # Bonus si un identifiant exact de la query (ex: "etxadm-493")
        # est retrouvé tel quel dans le document. Pondéré fort car un
        # identifiant exact est un signal beaucoup plus fiable qu'un
        # simple mot du vocabulaire commun.
        id_matches = query_ids & doc_words
        id_bonus = 0.5 * len(id_matches)

        rerank_score = round(base_score + id_bonus, 4)

        scored.append(
            RerankedDoc(
                text=doc.text,
                source=doc.source,
                score=doc.score,
                rerank_score=rerank_score,
                page_number=doc.page_number,
                metadata=doc.metadata,
            )
        )

    scored.sort(key=lambda x: x.rerank_score, reverse=True)
    return scored[: request.top_n]


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "reranker"}


@app.post("/v1/rerank", response_model=RerankerResponse)
async def rerank(request: RerankerRequest):
    """
    top_n : fourni par l'Orchestrator depuis la config Admin (clé "top_n").
    """
    try:
        reranked = simple_rerank(request)
        logger.info(
            "✅ Rerank OK — query='{}' {} docs → {} retenus",
            request.query[:60], len(request.documents), len(reranked),
        )
        return RerankerResponse(reranked_documents=reranked, total=len(reranked))
    except Exception as e:
        logger.error("❌ Erreur reranker: {}", e)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.reranker_port)