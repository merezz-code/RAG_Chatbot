from typing import List

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))
from shared.config import get_settings

settings = get_settings()

# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────

EMBEDDING_SERVICE_URL = settings.embedding_service_url

# ─────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────

class LateChunkRequest(BaseModel):
    chunks: List[str]
    filename: str = "document"


class LateChunk(BaseModel):
    text: str
    source: str
    chunk_index: int
    embedding: List[float]
    context_aware: bool = True


class LateChunkResponse(BaseModel):
    chunks: List[LateChunk]
    total_chunks: int
    filename: str
    model: str


# ─────────────────────────────────────────────────────────────
# FastAPI
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Late Chunking Service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def enrich_chunks(chunks: List[str]) -> List[str]:
    """
    Enrichit chaque chunk avec le contexte voisin.
    """

    enriched_chunks = []

    for i, chunk in enumerate(chunks):

        previous_chunk = (
            chunks[i - 1]
            if i > 0
            else ""
        )

        next_chunk = (
            chunks[i + 1]
            if i < len(chunks) - 1
            else ""
        )

        enriched_text = f"""
Previous Context:
{previous_chunk}

Current Chunk:
{chunk}

Next Context:
{next_chunk}
""".strip()

        enriched_chunks.append(enriched_text)

    return enriched_chunks


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{EMBEDDING_SERVICE_URL}/v1/embeddings",
            json={"input": texts}        
        )
        response.raise_for_status()
        data = response.json()

        # Le service Embedding retourne {"embeddings": [[...]]}
        # ou {"data": [{"embedding": [...]}]} selon l'implémentation
        if "embeddings" in data:
            return data["embeddings"]
        elif "data" in data:
            # Format OpenAI-compatible
            return [item["embedding"] for item in data["data"]]
        else:
            raise ValueError(f"Format de réponse inattendu: {list(data.keys())}")


# ─────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "late_chunking"
    }


@app.post("/late_chunk", response_model=LateChunkResponse)
@app.post("/v1/late_chunk", response_model=LateChunkResponse)
async def late_chunk(request: LateChunkRequest):

    if not request.chunks:
        raise HTTPException(
            status_code=400,
            detail="Aucun chunk fourni."
        )

    try:

        # 1. Enrichissement contextuel
        enriched_chunks = enrich_chunks(request.chunks)

        # 2. Génération des embeddings
        embeddings = await get_embeddings(enriched_chunks)

        if len(embeddings) != len(request.chunks):
            raise HTTPException(
                status_code=500,
                detail="Nombre d'embeddings invalide."
            )

        # 3. Construction de la réponse
        results = []

        for index, chunk_text in enumerate(request.chunks):

            results.append(
                LateChunk(
                    text=chunk_text,
                    source=request.filename,
                    chunk_index=index,
                    embedding=embeddings[index],
                    context_aware=True
                )
            )

        return LateChunkResponse(
            chunks=results,
            total_chunks=len(results),
            filename=request.filename,
            model="context-aware-neighbor-chunking"
        )

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Service Embedding inaccessible : "
                f"{EMBEDDING_SERVICE_URL}"
            )
        )

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Erreur Embedding Service : {e.response.text}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.late_chunking_port
    )