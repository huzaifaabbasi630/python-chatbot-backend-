import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="AI Chatbot API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY") or os.getenv("XAI_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

user_histories: Dict[str, Dict[str, Dict[str, Any]]] = {}


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[Message] = Field(default_factory=list)
    user_email: Optional[str] = None
    chat_id: Optional[str] = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_title(message: str) -> str:
    words = [word for word in message.split() if word]
    if not words:
        return "New Chat"
    return " ".join(words[:5]).strip()


def _build_messages(history: List[Message], message: str) -> List[Dict[str, str]]:
    messages = [{"role": "system", "content": "You are a sharp, helpful assistant."}]
    messages.extend([{"role": item.role, "content": item.content} for item in history])
    messages.append({"role": "user", "content": message})
    return messages


@app.post("/api/chat")
async def chat(request: ChatRequest) -> dict:
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("XAI_API_KEY")
    if not api_key or api_key == "your_key_here":
        raise HTTPException(
            status_code=500,
            detail="The Groq API key is not configured. Set GROQ_API_KEY in the backend .env file.",
        )

    try:
        if request.user_email:
            user_store = user_histories.setdefault(request.user_email, {})
            chat_id = request.chat_id or str(uuid.uuid4())
            session = user_store.get(chat_id)
            if session is None:
                session = {
                    "title": "New Chat",
                    "messages": [],
                    "created_at": _now(),
                    "updated_at": _now(),
                }
                user_store[chat_id] = session

            if not session["messages"]:
                session["title"] = _generate_title(request.message)

            session["messages"].append({"role": "user", "content": request.message})
            session["updated_at"] = _now()

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=_build_messages(request.history, request.message),
            )
            content = response.choices[0].message.content or "I could not generate a response."
            session["messages"].append({"role": "assistant", "content": content})
            session["updated_at"] = _now()
            return {"response": content, "chat_id": chat_id, "title": session["title"]}

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=_build_messages(request.history, request.message),
        )
        content = response.choices[0].message.content or "I could not generate a response."
        return {"response": content}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to process the chat request: {exc}") from exc


@app.get("/api/history")
async def get_history(email: str = Query(..., min_length=1)) -> dict:
    user_store = user_histories.get(email, {})
    sessions = [
        {
            "chat_id": chat_id,
            "title": session.get("title", "New Chat"),
            "created_at": session.get("created_at"),
            "updated_at": session.get("updated_at"),
        }
        for chat_id, session in user_store.items()
    ]
    sessions.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
    return {"history": sessions}


@app.get("/api/history/session")
async def get_session_history(email: str = Query(..., min_length=1), chat_id: str = Query(..., min_length=1)) -> dict:
    user_store = user_histories.get(email, {})
    session = user_store.get(chat_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "chat_id": chat_id,
        "title": session.get("title", "New Chat"),
        "messages": session.get("messages", []),
        "created_at": session.get("created_at"),
        "updated_at": session.get("updated_at"),
    }


@app.patch("/api/history/session/rename")
async def rename_session(
    email: str = Query(..., min_length=1),
    chat_id: str = Query(..., min_length=1),
    title: str = Query(..., min_length=1),
) -> dict:
    user_store = user_histories.get(email, {})
    session = user_store.get(chat_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    session["title"] = title.strip() or "Untitled Chat"
    session["updated_at"] = _now()
    return {"chat_id": chat_id, "title": session["title"]}


@app.delete("/api/history/session")
async def delete_session(email: str = Query(..., min_length=1), chat_id: str = Query(..., min_length=1)) -> dict:
    user_store = user_histories.get(email)
    if not user_store:
        raise HTTPException(status_code=404, detail="No histories found for that user")

    deleted = user_store.pop(chat_id, None)
    if deleted is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"deleted": True, "chat_id": chat_id}


@app.delete("/api/history/clear-all")
async def clear_all_history(email: str = Query(..., min_length=1)) -> dict:
    if email in user_histories:
        del user_histories[email]
    return {"deleted": True, "email": email}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
