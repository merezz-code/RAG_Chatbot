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

        # context = system_prompt_template déjà rempli par l'Orchestrator
        # question = user_prompt_template déjà rempli par l'Orchestrator
        messages = [SystemMessage(content=request.context)]

        for msg in request.history or []:
            if msg.role.lower() == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role.lower() == "assistant":
                messages.append(AIMessage(content=msg.content))

        messages.append(HumanMessage(content=request.question))

        response = llm.invoke(messages)
        return LLMResponse(answer=response.content)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.llm_port)