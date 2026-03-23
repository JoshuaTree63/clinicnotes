import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.rag_service import (
    analyze_with_groq,
    analyze_with_openrouter,
    retrieve_context,
)

router = APIRouter()
SESSIONS_DIR = os.getenv("SESSIONS_DIR", "./data/sessions")


class AnalyzeRequest(BaseModel):
    session_id: str


@router.post("/analyze")
async def analyze_session(request: AnalyzeRequest):
    session_path = os.path.join(SESSIONS_DIR, f"{request.session_id}.json")
    if not os.path.exists(session_path):
        raise HTTPException(404, detail="Session not found")

    with open(session_path, "r", encoding="utf-8") as f:
        session = json.load(f)

    transcript = session.get("transcript", "")
    if not transcript:
        raise HTTPException(400, detail="Session has no transcript to analyze")

    # Retrieve relevant PDF chunks
    context_chunks = retrieve_context(transcript)
    if not context_chunks:
        raise HTTPException(
            400, detail="No indexed documents found. Run /api/index first."
        )

    # Try Groq first, fall back to OpenRouter
    try:
        analysis = analyze_with_groq(transcript, context_chunks)
    except Exception:
        try:
            analysis = await analyze_with_openrouter(transcript, context_chunks)
        except Exception as openrouter_error:
            raise HTTPException(
                503,
                detail=f"Both Groq and OpenRouter failed: {str(openrouter_error)}",
            )

    # Save analysis back to session
    session["analysis"] = analysis
    with open(session_path, "w", encoding="utf-8") as f:
        json.dump(session, f, ensure_ascii=False, indent=2)

    return {"session_id": request.session_id, "analysis": analysis}


@router.get("/sessions")
def list_sessions():
    """List all stored session records."""
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    sessions = []
    for fname in sorted(os.listdir(SESSIONS_DIR), reverse=True):
        if fname.endswith(".json"):
            with open(os.path.join(SESSIONS_DIR, fname), "r") as f:
                s = json.load(f)
                sessions.append(
                    {
                        "id": s["id"],
                        "date": s["date"],
                        "filename": s.get("filename"),
                        "has_analysis": s.get("analysis") is not None,
                    }
                )
    return sessions


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    if not os.path.exists(path):
        raise HTTPException(404, detail="Session not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
