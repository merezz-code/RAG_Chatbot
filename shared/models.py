"""
shared/models.py
Tous les modèles Pydantic utilisés par les microservices Python.
Les paramètres dynamiques (top_k, top_n, chunk_size…) sont toujours
envoyés dans la requête par l'Orchestrator, qui les lit depuis Admin.
"""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any


# ═════════════════════════════════════════════════════════════════════════════
# EMBEDDINGS  :6002
# ═════════════════════════════════════════════════════════════════════════════

class EmbedRequest(BaseModel):
    """
    Accepte soit `texts` (batch) soit `input` (texte unique).
    Appelé par l'Orchestrator (.NET) et par LateChunking.
    """
    texts: Optional[List[str]] = None
    input: Optional[str]       = None

    def get_texts(self) -> List[str]:
        if self.texts:
            return self.texts
        if self.input:
            return [self.input]
        raise ValueError("Il faut soit 'texts' soit 'input'.")


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    total:      int
    model:      str


# ═════════════════════════════════════════════════════════════════════════════
# RETRIEVER  :6003
# ═════════════════════════════════════════════════════════════════════════════

class RetrieverRequest(BaseModel):
    """
    embedding  : vecteur de la query (calculé par l'Orchestrator).
    top_k      : envoyé par l'Orchestrator depuis la config Admin (clé "k").
    collection : nom de la collection Qdrant.
    """
    query:      str
    embedding:  List[float]
    top_k:      int    = 10
    collection: str    = "eurotax_docs"


class DocumentResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    text:        str
    score:       float
    source:      str               = ""
    file_name:   str               = ""
    page_number: int               = 0
    metadata:    Optional[Dict[str, Any]] = None


class RetrieverResponse(BaseModel):
    documents: List[DocumentResult]
    total:     int


# ═════════════════════════════════════════════════════════════════════════════
# RERANKER  :6004
# ═════════════════════════════════════════════════════════════════════════════

class RerankDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    text:        str
    source:      str               = ""
    score:       float             = 0.0
    page_number: int               = 0
    metadata:    Optional[Dict[str, Any]] = None


class RerankerRequest(BaseModel):
    """
    top_n  : envoyé par l'Orchestrator depuis la config Admin.
    """
    query:     str
    documents: List[RerankDocument]
    top_n:     int = 3


class RerankedDoc(BaseModel):
    text:         str
    source:       str               = ""
    score:        float             = 0.0
    rerank_score: float             = 0.0
    page_number:  int               = 0
    metadata:     Optional[Dict[str, Any]] = None


class RerankerResponse(BaseModel):
    reranked_documents: List[RerankedDoc]
    total:              int


# ═════════════════════════════════════════════════════════════════════════════
# GUARDRAILS  :6006
# ═════════════════════════════════════════════════════════════════════════════

class GuardrailScannerParams(BaseModel):
    """Paramètres d'un scanner individuel — envoyés par l'Orchestrator depuis Admin."""
    model_config = ConfigDict(extra="allow")   # chaque scanner a ses propres champs
    enabled: bool = False


class GuardrailRequest(BaseModel):
    """
    check_type       : "input" | "output" | "both"
    scanner_params   : dict de scanner_name → {enabled, threshold, …}
                       fourni par l'Orchestrator depuis input_guardrail_params
                       ou output_guardrail_params de la config Admin.
    """
    text:            str
    check_type:      str                        = "input"
    scanner_params:  Dict[str, Dict[str, Any]]  = {}


class GuardrailResponse(BaseModel):
    is_safe:           bool
    original_text:     str
    filtered_text:     Optional[str] = None
    reason:            Optional[str] = None
    check_type:        str
    triggered_scanner: Optional[str] = None


# ═════════════════════════════════════════════════════════════════════════════
# TEXT EXTRACTOR  :6000
# ═════════════════════════════════════════════════════════════════════════════

class ExtractResponse(BaseModel):
    filename:  str
    text:      str
    pages:     int
    file_type: str


# ═════════════════════════════════════════════════════════════════════════════
# TEXT SPLITTER  :6001
# ═════════════════════════════════════════════════════════════════════════════

class SplitRequest(BaseModel):
    """
    chunk_size / chunk_overlap : envoyés par l'Orchestrator depuis Admin.
    Alignés sur la configuration RAG du projet : 1000 / 150.
    """
    text:          str
    filename:      str           = "document"
    chunk_size:    int           = 1000
    chunk_overlap: int           = 150


class ChunkDocument(BaseModel):
    page_content: str
    metadata:     Dict[str, Any]


class SplitResponse(BaseModel):
    chunks:       List[ChunkDocument]
    total_chunks: int
    filename:     str


# ═════════════════════════════════════════════════════════════════════════════
# LATE CHUNKING  :6007
# ═════════════════════════════════════════════════════════════════════════════

class LateChunkRequest(BaseModel):
    """
    chunk_size / chunk_overlap : envoyés par l'Orchestrator depuis Admin.
    embedding_service_url      : URL du service Embeddings, injectée par l'Orchestrator.
    """
    text:                  str
    filename:              str  = "document"
    chunk_size:            int  = 800
    chunk_overlap:         int  = 100
    embedding_service_url: str  = "http://localhost:6002"


class LateChunkItem(BaseModel):
    text:          str
    source:        str
    chunk_index:   int
    embedding:     List[float]
    context_aware: bool = True


class LateChunkResponse(BaseModel):
    chunks:       List[LateChunkItem]
    total_chunks: int
    filename:     str
    model:        str


# ═════════════════════════════════════════════════════════════════════════════
# LLM  :6005
# ═════════════════════════════════════════════════════════════════════════════

class LLMRequest(BaseModel):
    """
    Tous les paramètres LLM (temperature, top_p, max_tokens, prompts)
    sont envoyés par l'Orchestrator depuis la config Admin.
    """
    question:              str
    context:               str                  = ""
    history:               List[Dict[str, str]] = []   # [{question, answer}, …]
    system_prompt_template: str                 = (
        "Tu es un assistant IA expert.\n"
        "Contexte :\n{context}\n\n"
        "Historique :\n{history}"
    )
    user_prompt_template:  str  = "{question}"
    temperature:           float = 0.7
    top_p:                 float = 0.95
    max_tokens:            int   = 1024
    repetition_penalty:    float = 1.05
    stream:                bool  = False


class SourceDocument(BaseModel):
    source: str
    page:   int = 0


class LLMResponse(BaseModel):
    answer:  str
    sources: List[SourceDocument] = []