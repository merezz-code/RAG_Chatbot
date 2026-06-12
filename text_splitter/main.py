from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))
from shared.config import get_settings

settings = get_settings()

# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────

class SplitRequest(BaseModel):
    model_config = {"extra": "ignore"}

    text: str
    filename: Optional[str] = "document"

    chunk_size: int = Field(
        default=800,
        gt=0,
        le=4000
    )

    chunk_overlap: int = Field(
        default=100,
        ge=0,
        le=1000
    )


class ChunkDocument(BaseModel):
    page_content: str
    metadata: dict


class SplitResponse(BaseModel):
    chunks: List[ChunkDocument]
    total_chunks: int
    filename: str


# ─────────────────────────────────────────────
# Recursive Splitter
# ─────────────────────────────────────────────

class RecursiveCharacterTextSplitter:

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 100,
        separators: List[str] | None = None
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or [
            "\n\n",
            "\n",
            ". ",
            " ",
            ""
        ]

    def split_text(self, text: str) -> List[str]:
        return self._split_text(text, self.separators)

    def _split_text(
        self,
        text: str,
        separators: List[str]
    ) -> List[str]:

        if len(text) <= self.chunk_size:
            return [text]

        separator = separators[-1]

        for sep in separators:
            if sep and sep in text:
                separator = sep
                break

        if separator == "":
            return self._split_by_length(text)

        splits = text.split(separator)

        chunks = []
        current = ""

        for piece in splits:

            candidate = (
                piece
                if not current
                else current + separator + piece
            )

            if len(candidate) <= self.chunk_size:
                current = candidate
            else:

                if current:
                    chunks.append(current)

                if len(piece) > self.chunk_size:

                    remaining = separators[1:] if len(separators) > 1 else [""]

                    chunks.extend(
                        self._split_text(piece, remaining)
                    )

                    current = ""
                else:
                    current = piece

        if current:
            chunks.append(current)

        return self._apply_overlap(chunks)

    def _split_by_length(self, text: str) -> List[str]:

        chunks = []

        start = 0

        while start < len(text):

            end = start + self.chunk_size

            chunks.append(text[start:end])

            start += self.chunk_size - self.chunk_overlap

        return chunks

    def _apply_overlap(
        self,
        chunks: List[str]
    ) -> List[str]:

        if self.chunk_overlap <= 0:
            return chunks

        result = []

        for i, chunk in enumerate(chunks):

            if i == 0:
                result.append(chunk)
                continue

            previous = chunks[i - 1]

            overlap = previous[-self.chunk_overlap:]

            result.append(overlap + chunk)

        return result


# ─────────────────────────────────────────────
# FastAPI
# ─────────────────────────────────────────────

app = FastAPI(
    title="Text Splitter Service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "text_splitter"
    }


@app.post("/split", response_model=SplitResponse)
@app.post("/v1/split", response_model=SplitResponse)
async def split(request: SplitRequest):

    if not request.text.strip():
        raise HTTPException(
            status_code=400,
            detail="Texte vide."
        )

    if request.chunk_overlap >= request.chunk_size:
        raise HTTPException(
            status_code=400,
            detail="chunk_overlap doit être inférieur à chunk_size"
        )

    try:

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap
        )

        texts = splitter.split_text(request.text)

        chunks = [
            ChunkDocument(
                page_content=text,
                metadata={
                    "source": request.filename,
                    "chunk_index": index,
                    "char_count": len(text)
                }
            )
            for index, text in enumerate(texts)
        ]

        return SplitResponse(
            chunks=chunks,
            total_chunks=len(chunks),
            filename=request.filename
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.text_splitter_port
    )