import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from shared.models import SplitRequest
from text_splitter.main import RecursiveCharacterTextSplitter


def test_rag_style_splitter_method_exists_and_splits_text():
    splitter = RecursiveCharacterTextSplitter(chunk_size=20, chunk_overlap=5)
    chunks = splitter.recursive_text_splitter("Bonjour ceci est un texte de test pour le RAG.")

    assert hasattr(splitter, "recursive_text_splitter")
    assert len(chunks) >= 2
    assert all(isinstance(chunk, str) and chunk.strip() for chunk in chunks)


def test_shared_split_request_defaults_match_rag_chunking():
    request = SplitRequest(text="demo")
    assert request.chunk_size == 1000
    assert request.chunk_overlap == 150
