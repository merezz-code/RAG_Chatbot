from pydantic import BaseModel
from typing import List, Optional, Union


# ─── Text Extractor ───────────────────────────
class ExtractRequest(BaseModel):
    file_path: str
    file_type: str  # pdf, docx, xlsx, pptx, txt

class ExtractResponse(BaseModel):
    text: str
    metadata: dict = {}

# ─── Embeddings ───────────────────────────────
class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]]

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model: str

# ─── Retriever ────────────────────────────────
class RetrieverRequest(BaseModel):
    query: str
    embedding: List[float]
    top_k: int = 10
    collection: str = "eurotax_docs"

class RetrieverResponse(BaseModel):
    documents: List[dict]
    total: int

# ─── Reranker ─────────────────────────────────
class RerankRequest(BaseModel):
    query: str
    documents: List[dict]
    top_n: int = 3

class RerankResponse(BaseModel):
    reranked_documents: List[dict]

# ─── Chat ─────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # user, assistant, system
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    collection: str = "monrag_documents"
    top_k: int = 10
    top_n: int = 3
    stream: bool = True


# ─── Text Splitter ────────────────────────────

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