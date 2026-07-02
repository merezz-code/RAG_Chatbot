"""
retrievers/main.py  —  FastAPI :6003
Recherche vectorielle Qdrant + repêchage lexical pour les identifiants exacts.
"""
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient, models
from loguru import logger

from shared.config import get_settings
from shared.models import RetrieverRequest, RetrieverResponse

# ── Config ────────────────────────────────────────────────────────────────────
settings = get_settings()
qdrant   = QdrantClient(
    url=settings.qdrant_url,
    api_key=settings.qdrant_api_key,
    check_compatibility=False,
)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Retriever Service", version="2.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# ── Hybrid search : repêchage lexical des identifiants exacts ────────────────
#
# PROBLÈME OBSERVÉ : un identifiant opaque type "ETXADM-493" ou un numéro de
# document type "500010204" n'a pas de sens sémantique pour un modèle
# d'embedding. La query "quelle est la date du ticket ETXADM-493 ?" est
# sémantiquement proche de N'IMPORTE QUEL texte parlant de dates et de
# tickets — pas spécifiquement du chunk qui contient CE code précis.
# Résultat vérifié dans Qdrant : le chunk contenant "ETXADM-493" existe bien
# dans la collection, mais n'est pas dans le top_k vectoriel (ex: top_k=10),
# donc il n'arrive jamais jusqu'au reranker, qui ne peut pas le "sauver".
#
# FIX : en plus de la recherche vectorielle, on détecte les identifiants
# "forts" de la query (alphanumériques avec au moins une lettre + un chiffre,
# type codes Jira, numéros de document, références produit...) et on lance
# une recherche lexicale complémentaire sur le payload Qdrant (MatchText),
# puis on fusionne les deux listes de résultats avant de les renvoyer.
# Ça ne nécessite NI ré-ingestion NI changement de schéma de collection :
# MatchText fonctionne même sans index full-text dédié (juste plus lent en
# mode substring, ce qui est acceptable à l'échelle de la collection ici).
# Pattern A : codes avec séparateur interne (tiret ou underscore) mélangeant
# lettres et chiffres, type "ETXADM-493", "FA-001746", "_3RDNAM".
_ID_PATTERN_SEPARATED = re.compile(r"\b[a-zA-Z0-9]*[_-][a-zA-Z0-9]+(?:[_-][a-zA-Z0-9]+)*\b")

# Pattern B : alphanumériques collés sans séparateur, mélangeant lettres et
# chiffres, type "500010204A" ou "26FRD0002077139".
_ID_PATTERN_MIXED = re.compile(r"\b(?=[a-zA-Z0-9]*[a-zA-Z])(?=[a-zA-Z0-9]*\d)[a-zA-Z0-9]+\b")

# Longueur minimale pour éviter de capter du bruit (sigles courts sans valeur
# d'identifiant, type "v2" pris isolément dans une phrase qui n'en a pas besoin).
MIN_IDENTIFIER_LENGTH = 4

# Champs de payload sur lesquels tenter le repêchage lexical, dans l'ordre.
# "text" couvre le texte indexé par défaut (cf. text_splitter), "page_content"
# est l'alias utilisé à certains endroits du pipeline.
LEXICAL_PAYLOAD_FIELDS = ["text", "page_content"]

# Combien de points le repêchage lexical va chercher au maximum par identifiant.
LEXICAL_FETCH_LIMIT = 10

# top_k plancher : même si l'Orchestrator envoie un top_k bas (ex: 10) depuis
# la config Admin, on élargit la recherche vectorielle en interne avant
# reranking, pour donner une meilleure chance aux chunks pertinents de
# survivre à l'étape suivante. Le top_k demandé par le client est toujours
# respecté pour le NOMBRE de documents retournés (voir plus bas).
MIN_VECTOR_FETCH = 30


def extract_strong_identifiers(query: str) -> list[str]:
    """Extrait les identifiants forts (ex: ETXADM-493, _3RDNAM, 500010204A) de la query."""
    candidates = {m.group(0) for m in _ID_PATTERN_SEPARATED.finditer(query)}
    candidates |= {m.group(0) for m in _ID_PATTERN_MIXED.finditer(query)}
    return [c for c in candidates if len(c) >= MIN_IDENTIFIER_LENGTH]


def lexical_fetch(collection: str, identifier: str) -> list:
    """
    Recherche les points dont le payload contient l'identifiant exact,
    sans dépendre d'un index full-text Qdrant.
    """

    found = []
    offset = None
    identifier = identifier.upper()

    while True:
        points, offset = qdrant.scroll(
            collection_name=collection,
            with_payload=True,
            limit=100,
            offset=offset,
        )

        for point in points:
            payload = point.payload or {}

            text = (
                payload.get("text")
                or payload.get("page_content")
                or ""
            )

            if identifier in text.upper():
                found.append(point)

                if len(found) >= LEXICAL_FETCH_LIMIT:
                    return found

        if offset is None:
            break

    return found
def build_document(payload: dict, score: float) -> dict:
    """Construit un document de réponse à partir d'un payload Qdrant, quel
    que soit son champ source d'origine (point vectoriel ou point lexical)."""
    file_name   = payload.get("file_name", payload.get("source", "unknown_source"))
    page_number = int(payload.get("page_number", payload.get("chunk_index", 0)))

    return {
        "text":        payload.get("text", payload.get("page_content", "")),
        "score":       score,
        "source":      file_name,
        "file_name":   file_name,
        "page_number": page_number,
        "metadata": {
            **{k: v for k, v in payload.items() if k != "text"},
            "page_number": page_number,
        },
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "retriever"}


@app.post("/v1/retrieve", response_model=RetrieverResponse)
async def retrieve(request: RetrieverRequest):
    try:
        # ── 1. Recherche vectorielle, élargie au-delà du top_k demandé ──
        # (le filtrage final au top_k réel se fait à la toute fin, après
        # fusion avec les résultats lexicaux, pour ne pas perdre de place)
        vector_fetch_limit = max(request.top_k, MIN_VECTOR_FETCH)

        result = qdrant.query_points(
            collection_name=request.collection,
            query=request.embedding,
            limit=vector_fetch_limit,
            with_payload=True,
        )

        # point_id -> (document_dict, best_score) pour dédoublonnage
        merged: dict = {}

        for hit in result.points:
            payload = hit.payload or {}
            merged[hit.id] = (build_document(payload, hit.score), hit.score)

        # ── 2. Repêchage lexical des identifiants exacts de la query ──
        identifiers = extract_strong_identifiers(request.query)

        if identifiers:
            logger.info(
                "🔎 Identifiants détectés dans la query : {}", identifiers
            )

        for identifier in identifiers:
            lexical_points = lexical_fetch(request.collection, identifier)

            for point in lexical_points:
                payload = point.payload or {}
                # Score artificiel élevé : un match exact d'identifiant est
                # un signal très fort, on le place donc au-dessus de la
                # plupart des scores cosinus pour qu'il survive au top_k
                # final et au reranking, sans pour autant écraser un éventuel
                # score vectoriel déjà très élevé sur ce même point.
                lexical_score = max(1.0, merged.get(point.id, (None, 0.0))[1])

                if point.id not in merged or lexical_score > merged[point.id][1]:
                    merged[point.id] = (
                        build_document(payload, lexical_score),
                        lexical_score,
                    )

        # ── 3. Tri final par score et troncature au top_k demandé ──
        documents = [doc for doc, _ in sorted(
            merged.values(), key=lambda x: x[1], reverse=True
        )][: request.top_k]

        logger.info(
            "✅ {} documents récupérés depuis '{}' (vector_fetch={}, "
            "repêchage_lexical={} identifiant(s), top_k final={})",
            len(documents), request.collection, vector_fetch_limit,
            len(identifiers), request.top_k,
        )
        return RetrieverResponse(documents=documents, total=len(documents))

    except Exception as e:
        logger.error("❌ Erreur retriever: {}", e)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.retriever_port)