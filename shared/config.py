import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parent.parent
print(ROOT_DIR)
ENV_PATH = os.path.join(ROOT_DIR, ".env")

class Settings(BaseSettings):
    # Azure OpenAI
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment: str
    azure_openai_embedding_deployment: str
    azure_openai_api_version: str
    hf_api_key: str

    # Qdrant
    qdrant_url: str
    qdrant_api_key : str
    qdrant_collection_name: str

    # Ports
    text_extractor_port: int
    text_splitter_port: int
    embedding_port: int
    retriever_port: int
    reranker_port: int
    guardrail_input_port: int
    guardrail_output_port: int

    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding='utf-8',
        extra='ignore'
    )

def get_settings():
    return Settings()

