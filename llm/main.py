from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))
from shared.config import get_settings

settings = get_settings()

app = FastAPI(title="LLM Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class LLMRequest(BaseModel):
    question: str
    context: str
    history: Optional[List[ChatMessage]] = []
    temperature: Optional[float] = None
    max_new_tokens: Optional[int] = None
    top_p: Optional[float] = None
    repetition_penalty: Optional[float] = None


class LLMResponse(BaseModel):
    answer: str
    contextualized_question: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Helper : Réécriture de la question basée sur l'historique (Multi-document)
# ──────────────────────────────────────────────────────────────────────────────
def contextualize_user_query(question: str, history: List[ChatMessage], llm_client: AzureChatOpenAI) -> str:
    """
    Analyse l'historique pour reformuler la question de manière autonome
    si l'utilisateur utilise des termes relatifs ("ce ticket", "cette ligne", "la date de l'export").
    """
    if not history:
        return question

    # Construction d'un mini historique textuel pour le prompt de contextualisation
    formatted_history = ""
    for msg in history[-4:]:  # On prend les 4 derniers messages pour garder de la vélocité
        role_label = "Utilisateur" if msg.role.lower() == "user" else "Assistant"
        formatted_history += f"{role_label}: {msg.content}\n"

    prompt_rewriter = (
        "Compte tenu de l'historique de discussion suivant et d'une question de suivi, "
        "reformulez la question pour qu'elle devienne une question autonome (stand-alone), "
        "en y incluant explicitement les entités nommées, codes de tickets (ex: ETXADM, JIRA), "
        "ou noms de fichiers (ex: TDCS, PDF, Excel) mentionnés précédemment.\n"
        "Ne répondez pas à la question, retournez UNIQUEMENT la question reformulée.\n\n"
        f"Historique :\n{formatted_history}\n"
        f"Question de suivi : {question}\n"
        "Question autonome reformulée :"
    )
    
    try:
        res = llm_client.invoke([SystemMessage(content=prompt_rewriter)])
        cleaned_query = res.content.strip()
        if cleaned_query:
            return cleaned_query
    except Exception:
        pass # Fallback sur la question initiale en cas de timeout/erreur
    return question


@app.get("/health")
async def health():
    return {"status": "ok", "service": "llm"}


@app.post("/v1/generate", response_model=LLMResponse)
async def generate(request: LLMRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question vide.")
    try:
        llm = AzureChatOpenAI(
            azure_deployment=settings.azure_openai_deployment,
            azure_endpoint=settings.azure_openai_endpoint,
            openai_api_version=settings.azure_openai_api_version,
            api_key=settings.azure_openai_api_key,
            temperature=request.temperature
                if request.temperature is not None
                else getattr(settings, "llm_temperature", 0.7),
            max_tokens=request.max_new_tokens
                if request.max_new_tokens is not None
                else getattr(settings, "llm_max_tokens", 1024),
        )

        # 1. Traitement de contextualisation universel (Excel, PDF, TDCS...)
        final_question = request.question
        if request.history:
            final_question = contextualize_user_query(request.question, request.history, llm)

        # 2. Construction de la structure finale des messages pour la réponse finale
        messages = [SystemMessage(content=request.context)]

        for msg in request.history or []:
            if msg.role.lower() == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role.lower() == "assistant":
                messages.append(AIMessage(content=msg.content))

        # On envoie la question enrichie au LLM pour qu'il trouve l'info sans ambiguïté
        messages.append(HumanMessage(content=final_question))

        response = llm.invoke(messages)
        
        return LLMResponse(
            answer=response.content,
            contextualized_question=final_question if final_question != request.question else None
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.llm_port)