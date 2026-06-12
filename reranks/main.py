"""
reranks/main.py  —  FastAPI :6004
Reranking lexical des documents récupérés.
top_n vient de la requête Orchestrator (lu depuis Admin).
Aucun appel à d'autres services Python.
"""
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

app = FastAPI(title="Reranker Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


# ── Reranking ─────────────────────────────────────────────────────────────────
def simple_rerank(request: RerankerRequest) -> list[RerankedDoc]:
    """
    Reranking par chevauchement de mots (word-overlap).
    Remplaçable par un cross-encoder sans changer l'interface.
    top_n vient de la requête (fourni par Orchestrator depuis Admin).
    """
    query_words = set(request.query.lower().split())
    scored: list[RerankedDoc] = []

    for doc in request.documents:
        doc_words    = set(doc.text.lower().split())
        overlap      = len(query_words & doc_words)
        rerank_score = round(overlap / (len(query_words) + 1), 4)
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