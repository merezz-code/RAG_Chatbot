from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from pathlib import Path
import sys
import re

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))
from shared.config import get_settings

settings = get_settings()

# ─────────────────────────────────────────────
# Modèles Pydantic
# ─────────────────────────────────────────────

class SplitRequest(BaseModel):
    model_config = {"extra": "ignore"}
    text: str
    filename: Optional[str] = "document"
    chunk_size: int = Field(default=1000, gt=0, le=4000)
    chunk_overlap: int = Field(default=150, ge=0, le=1000)

class ChunkDocument(BaseModel):
    page_content: str
    metadata: dict

class SplitResponse(BaseModel):
    chunks: List[ChunkDocument]
    total_chunks: int
    filename: str


# ─────────────────────────────────────────────
# Splitter
# ─────────────────────────────────────────────

class RecursiveCharacterTextSplitter:

    def __init__(self, chunk_size=1000, chunk_overlap=150, separators=None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", ", ", ": ", " ", ""]

    def _preprocess_text(self, text: str) -> str:
        """
        FIX FINAL : on corrige UNIQUEMENT les coupures de mots dues au PDF
        (ex: ETXADM-\n493 → ETXADM-493) SANS fusionner les lignes du tableau.

        SUPPRIMÉ : le remplacement global \n → espace qui détruisait la
        structure des tableaux et faisait disparaître ETXADM-493 en l'absorbant
        dans un bloc de 4000 caractères coupé au mauvais endroit.
        """
        # 1. Recoller uniquement les identifiants coupés sur 2 lignes
        #    ex: "ETXADM-\n493" → "ETXADM-493"
        text = re.sub(r'(ETXADM)-\s*\n\s*(\d+)', r'\1-\2', text)

        # 2. Recoller les mots coupés par un tiret en fin de ligne
        #    ex: "compli-\nance" → "compliance"
        #    Attention : ne pas toucher aux tirets qui sont des séparateurs
        #    de tableau (lignes commençant par des tirets)
        text = re.sub(r'([a-zA-Z])-\n([a-zA-Z])', r'\1\2', text)

        # 3. Nettoyer les espaces multiples (artefacts colonnes PDF)
        text = re.sub(r' {3,}', '  ', text)

        return text

    def split_text(self, text: str) -> List[str]:
        clean_text = self._preprocess_text(text)
        return self.recursive_text_splitter(clean_text)

    def recursive_text_splitter(self, text: str) -> List[str]:
        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + self.chunk_size, text_len)
            if end < text_len:
                while end < text_len and text[end] not in " .,:;\n":
                    end += 1
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            if end >= text_len:
                break

            new_start = end - self.chunk_overlap
            if new_start <= start:
                new_start = end
            start = new_start

        return chunks


# ─────────────────────────────────────────────
# FastAPI
# ─────────────────────────────────────────────

app = FastAPI(title="Text Splitter Service", version="1.0.4")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "text_splitter"}


@app.post("/split", response_model=SplitResponse)
@app.post("/v1/split", response_model=SplitResponse)
async def split(request: SplitRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide.")
    if request.chunk_overlap >= request.chunk_size:
        raise HTTPException(status_code=400, detail="chunk_overlap doit être inférieur à chunk_size")

    try:
        is_tabular = False
        if request.filename:
            fn_lower = request.filename.lower()
            is_tabular = any(fn_lower.endswith(ext) for ext in [".xlsx", ".xls", ".csv"])

        if is_tabular:
            raw_lines = request.text.split("\n\n")
            texts = [l.strip() for l in raw_lines if l.strip() and not l.startswith("## Feuille")]
        else:
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=request.chunk_size,
                chunk_overlap=request.chunk_overlap
            )
            texts = splitter.split_text(request.text)

        chunks = [
            ChunkDocument(
                page_content=text,  # ✅ PAS de préfixe [Source:] — polluait Qdrant
                metadata={
                    "source": request.filename,
                    "file_name": request.filename,
                    "chunk_index": index,
                    "page_number": index,
                    "char_count": len(text),
                    "is_tabular": is_tabular
                }
            )
            for index, text in enumerate(texts)
        ]

        return SplitResponse(chunks=chunks, total_chunks=len(chunks), filename=request.filename)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.text_splitter_port)