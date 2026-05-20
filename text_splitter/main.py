import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dataclasses import dataclass, field

load_dotenv()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Text Splitter Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

USVC_PORT = int(os.getenv("TEXT_SPLITTER_USVC_PORT", 6001))


# ── Modèles Pydantic (remplace shared.models si besoin) ──────────────────────
class SplitRequest(BaseModel):
    text: str
    filename: Optional[str] = "document"
    chunk_size: int = 500
    chunk_overlap: int = 50


class ChunkDocument(BaseModel):
    page_content: str
    metadata: dict


class SplitResponse(BaseModel):
    chunks: List[ChunkDocument]
    total_chunks: int
    filename: str


# ── RecursiveCharacterTextSplitter maison ────────────────────────────────────
class RecursiveCharacterTextSplitter:
    """
    Équivalent de langchain RecursiveCharacterTextSplitter.
    Divise le texte en essayant chaque séparateur dans l'ordre.
    """
    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        separators: List[str] = None,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ".", " ", ""]

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        """Divise récursivement avec le meilleur séparateur disponible."""
        final_chunks = []
        separator = separators[-1]  # fallback : caractère par caractère

        # Cherche le premier séparateur qui donne de bons résultats
        for sep in separators:
            if sep == "" or sep in text:
                separator = sep
                break

        splits = text.split(separator) if separator != "" else list(text)

        # Fusionne les petits morceaux et re-divise les trop grands
        current_chunks: List[str] = []
        current_len = 0

        for split in splits:
            split_len = len(split)

            if current_len + split_len + len(separator) > self.chunk_size:
                if current_chunks:
                    chunk = separator.join(current_chunks)
                    final_chunks.append(chunk)
                    # Overlap : garde les derniers éléments
                    while current_chunks and current_len > self.chunk_overlap:
                        removed = current_chunks.pop(0)
                        current_len -= len(removed) + len(separator)

            if split_len > self.chunk_size:
                # Morceau trop grand : récursion avec séparateur suivant
                remaining = [s for s in separators if s != separator]
                if remaining:
                    sub_chunks = self._split_text(split, remaining)
                    final_chunks.extend(sub_chunks)
                else:
                    final_chunks.append(split)
            else:
                current_chunks.append(split)
                current_len += split_len + len(separator)

        if current_chunks:
            final_chunks.append(separator.join(current_chunks))

        return [c for c in final_chunks if c.strip()]

    def split_text(self, text: str) -> List[str]:
        return self._split_text(text, self.separators)


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "text_splitter"}


@app.post("/v1/split", response_model=SplitResponse)
async def split(request: SplitRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide.")
    try:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        texts = splitter.split_text(request.text)
        chunks = [
            ChunkDocument(
                page_content=t,
                metadata={
                    "source": request.filename,
                    "chunk_index": i
                }
            )
            for i, t in enumerate(texts)
        ]
        return SplitResponse(
            chunks=chunks,
            total_chunks=len(chunks),
            filename=request.filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=USVC_PORT)