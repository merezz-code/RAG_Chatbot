"""
reranks/main.py  — FastAPI :6004
Le top_n est maintenant envoyé par l'Orchestrator, qui le lit depuis le Control Panel Admin.
"""
import sys
import os
sys.path.append("..")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from loguru import logger

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    print("✅ scikit-learn OK", flush=True)
except ImportError:
    print("❌ Installez : pip install scikit-learn numpy", flush=True)
    sys.exit(1)


# ── Modèles ───────────────────────────────────────────────────────────────────

class RerankRequest(BaseModel):
    query: str
    documents: List[dict]
    top_n: int = 3                          # ← valeur par défaut, overridée par Admin
    score_threshold: Optional[float] = None # ← filtre optionnel depuis Admin


class RerankResponse(BaseModel):
    reranked_documents: List[dict]


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Reranker Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

USVC_PORT = int(os.getenv("RERANKER_USVC_PORT", 6004))


# ── Reranker TF-IDF ───────────────────────────────────────────────────────────

class TFIDFReranker:
    def score(self, query: str, documents: List[str]) -> List[float]:
        if not documents:
            return []
        corpus = [query] + documents
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, strip_accents="unicode")
        try:
            tfidf_matrix = vectorizer.fit_transform(corpus)
        except ValueError:
            return [0.0] * len(documents)

        query_vec = tfidf_matrix[0]
        doc_vecs  = tfidf_matrix[1:]
        scores    = cosine_similarity(query_vec, doc_vecs).flatten()
        return scores.tolist()


reranker = TFIDFReranker()
print("✅ Reranker TF-IDF prêt", flush=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "reranker", "model": "tfidf-cosine"}


@app.post("/v1/rerank", response_model=RerankResponse)
async def rerank(request: RerankRequest):
    """
    top_n et score_threshold sont envoyés par l'Orchestrator
    qui les lit depuis le Control Panel Admin (clés "top_n" et "rerank_score_threshold").
    """
    if not request.documents:
        raise HTTPException(status_code=400, detail="Aucun document fourni.")

    try:
        texts  = [doc["text"] for doc in request.documents]
        scores = reranker.score(request.query, texts)

        scored_docs = sorted(
            zip(request.documents, scores),
            key=lambda x: x[1],
            reverse=True
        )

        # Filtre par score_threshold si fourni par l'Admin
        if request.score_threshold is not None:
            scored_docs = [(d, s) for d, s in scored_docs if s >= request.score_threshold]

        top_docs = [
            {**doc, "rerank_score": round(float(score), 4)}
            for doc, score in scored_docs[:request.top_n]  # ← top_n depuis Admin
        ]

        logger.info(
            f"✅ Top {len(top_docs)} documents reranked "
            f"(top_n={request.top_n}, threshold={request.score_threshold})"
        )
        return RerankResponse(reranked_documents=top_docs)

    except KeyError:
        raise HTTPException(status_code=422, detail="Chaque document doit avoir un champ 'text'.")
    except Exception as e:
        logger.error(f"Erreur rerank : {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Lancement ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print(f"▶ Lancement sur http://0.0.0.0:{USVC_PORT}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=USVC_PORT)