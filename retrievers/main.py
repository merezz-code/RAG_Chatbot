"""
retrievers/main.py  —  FastAPI :6003
Recherche vectorielle Qdrant.
top_k vient de la requête Orchestrator (lu depuis Admin, clé "k").
Aucun appel à d'autres services Python.
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient
from loguru import logger

from shared.config import get_settings
from shared.models import RetrieverRequest, RetrieverResponse

# ── Config ────────────────────────────────────────────────────────────────────
settings = get_settings()
qdrant   = QdrantClient(
    url=settings.qdrant_url,
    api_key=settings.qdrant_api_key,
    check_compatibility=False,
)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Retriever Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "retriever"}


@app.post("/v1/retrieve", response_model=RetrieverResponse)
async def retrieve(request: RetrieverRequest):
    """
    top_k     : fourni par l'Orchestrator depuis la config Admin (clé "k").
    collection: fourni par l'Orchestrator.
    embedding : vecteur de la query calculé par l'Orchestrator via :6002.
    """
    try:
        result = qdrant.query_points(
            collection_name=request.collection,
            query=request.embedding,
            limit=request.top_k,
            with_payload=True,
        )

        documents = []
        for hit in result.points:
            payload     = hit.payload or {}
            file_name   = payload.get("file_name", payload.get("source", ""))
            page_number = int(payload.get("page_number", payload.get("chunk_index", 0)))

            documents.append({
                "text":        payload.get("text", ""),
                "score":       hit.score,
                "source":      file_name,
                "file_name":   file_name,
                "page_number": page_number,
                "metadata": {
                    **{k: v for k, v in payload.items() if k != "text"},
                    "page_number": page_number,
                },
            })

        logger.info(
            "✅ {} documents récupérés depuis '{}' (top_k={})",
            len(documents), request.collection, request.top_k,
        )
        return RetrieverResponse(documents=documents, total=len(documents))

    except Exception as e:
        logger.error("❌ Erreur retriever: {}", e)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.retriever_port)