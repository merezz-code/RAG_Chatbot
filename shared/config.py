import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = os.path.join(ROOT_DIR, ".env")


class Settings(BaseSettings):
    # ── Azure OpenAI ──────────────────────────────────────────────────────────
    azure_openai_endpoint:             str
    azure_openai_api_key:              str
    azure_openai_deployment:           str
    azure_openai_embedding_deployment: str
    azure_openai_api_version:          str

    # ── Hugging Face (embeddings locaux) ─────────────────────────────────────
    hf_api_key: str = ""

    # ── Qdrant ────────────────────────────────────────────────────────────────
    qdrant_url:             str
    qdrant_api_key:         str
    qdrant_collection_name: str

    # ── URLs inter-services (utilisées par LLM pour appeler Embeddings) ──────
    # Tous les autres services reçoivent les URLs via la requête Orchestrator
    # ou n'appellent pas d'autres services Python directement.
    embedding_service_url:    str = "http://localhost:6002"

    # ── Ports ─────────────────────────────────────────────────────────────────
    text_extractor_port:   int = 6000
    text_splitter_port:    int = 6001
    embedding_port:        int = 6002
    retriever_port:        int = 6003
    reranker_port:         int = 6004
    llm_port:              int = 6005
    guardrail_input_port:  int = 6006
    guardrail_output_port: int = 6006   # même service, routes différentes
    late_chunking_port:    int = 6007

    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )


def get_settings() -> Settings:
    return Settings() 
