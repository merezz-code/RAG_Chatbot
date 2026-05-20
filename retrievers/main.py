"""
retrievers/main.py  — FastAPI :6003
Le top_k est maintenant envoyé par l'Orchestrator, qui le lit depuis le Control Panel Admin.
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))

from fastapi import FastAPI, HTTPException
from qdrant_client import QdrantClient
from loguru import logger

from shared.config import get_settings
from shared.models import RetrieverRequest, RetrieverResponse

app = FastAPI(title="Retriever Service", version="1.0.0")

settings = get_settings()
qdrant = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "retriever"}


@app.post("/v1/retrieve", response_model=RetrieverResponse)
async def retrieve(request: RetrieverRequest):
    """
    top_k vient désormais de l'Orchestrator qui le lit depuis le Control Panel Admin
    (clé "k" dans PipelineConfigService).
    Valeur par défaut du modèle Pydantic : 10.
    """
    try:
        result = qdrant.query_points(
            collection_name=request.collection,
            query=request.embedding,
            limit=request.top_k,          # ← dynamique depuis le panneau Admin
            with_payload=True,
        )

        documents = []
        for hit in result.points:
            payload    = hit.payload or {}
            file_name  = payload.get("file_name", payload.get("source", ""))
            page_number = payload.get("page_number", payload.get("chunk_index", 0))

            documents.append({
                "text":     payload.get("text", ""),
                "score":    hit.score,
                "source":   file_name,
                "metadata": {
                    **{k: v for k, v in payload.items() if k != "text"},
                    "page_number": page_number,
                },
            })

        logger.info(
            f"✅ {len(documents)} documents récupérés depuis '{request.collection}' "
            f"(top_k={request.top_k})"
        )
        return RetrieverResponse(documents=documents, total=len(documents))

    except Exception as e:
        logger.error(f"❌ Erreur retriever: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=6003)