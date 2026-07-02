# embeddings/main.py — version finale locale
from fastapi import FastAPI
from pydantic import BaseModel
from fastembed import TextEmbedding

app = FastAPI()

print("⏳ Chargement du modèle d'embedding...")

try:
    embedder = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
    print("✅ Modèle prêt")
except Exception as e:
    print(f"❌ Erreur chargement modèle : {e}")
    raise

class EmbeddingRequest(BaseModel):
    input: str | list[str]
    

class EmbeddingResponse(BaseModel):
    embeddings: list[list[float]]
    model: str

@app.get("/health")
async def health():
    return {"status": "ok", "service": "embeddings"}

@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def embed(request: EmbeddingRequest):
    inputs = request.input if isinstance(request.input, list) else [request.input]
    vectors = list(embedder.embed(inputs))
    return EmbeddingResponse(
        embeddings=[v.tolist() for v in vectors],
        model="BAAI/bge-small-en-v1.5"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=6002)