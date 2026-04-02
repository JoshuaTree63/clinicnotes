import io
import json
import os

from fastapi import APIRouter, HTTPException, UploadFile, File, concurrency
from pydantic import BaseModel
from services.groq_service import diarize_transcript, format_transcript_for_llm
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

    # Build transcript text for analysis — prefer diarized format, fall back to legacy
    diarized_turns = session.get("transcript_diarized")
    if diarized_turns:
        transcript = format_transcript_for_llm(diarized_turns)
    else:
        # Backwards compat: old sessions with plain "transcript" field
        transcript = session.get("transcript", "")

    if not transcript:
        raise HTTPException(400, detail="Session has no transcript to analyze")

    # Retrieve relevant PDF chunks
    context_chunks = await concurrency.run_in_threadpool(retrieve_context, transcript)
    if not context_chunks:
        raise HTTPException(
            400, detail="No indexed documents found. Run /api/index first."
        )

    # Try Groq first, fall back to OpenRouter (running in threads)
    try:
        analysis = await concurrency.run_in_threadpool(analyze_with_groq, transcript, context_chunks)
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
                        "source": s.get("source", "audio"),
                        "speaker_count": s.get("speaker_count"),
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


import docx


@router.post("/sessions/{session_id}/transcript/override")
async def override_transcript(session_id: str, file: UploadFile = File(...)):
    """
    Override a session's transcript with an uploaded .docx or .pdf file.
    Re-runs diarization on the new content.
    """
    filename = file.filename.lower()

    path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    if not os.path.exists(path):
        raise HTTPException(404, detail="Session not found")

    try:
        # Extract text from the uploaded file
        if filename.endswith(".docx"):
            source_type = "manual_docx"
            contents = file.file.read()
            doc = docx.Document(io.BytesIO(contents))
            new_text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())
        elif filename.endswith(".pdf"):
            import fitz
            source_type = "manual_pdf"
            contents = file.file.read()
            pdf_doc = fitz.open(stream=contents, filetype="pdf")
            new_text = "\n".join(page.get_text() for page in pdf_doc)
        else:
            raise HTTPException(400, detail="Only .docx and .pdf files are supported")

        if not new_text.strip():
            raise HTTPException(400, detail="Could not extract text from the uploaded file")

        # Re-diarize the new transcript
        diarization = await concurrency.run_in_threadpool(diarize_transcript, new_text)

        # Load and update session JSON
        with open(path, "r", encoding="utf-8") as f:
            session = json.load(f)

        session["source"] = source_type
        session["transcript_raw"] = new_text
        session["transcript_diarized"] = diarization["turns"]
        session["speaker_count"] = diarization["speaker_count"]
        # Keep legacy field for backwards compat
        session["transcript"] = new_text
        # Clear old analysis since transcript changed
        session["analysis"] = None

        # Write back
        with open(path, "w", encoding="utf-8") as f:
            json.dump(session, f, ensure_ascii=False, indent=2)

        return {
            "status": "success",
            "session_id": session_id,
            "source": source_type,
            "speaker_count": diarization["speaker_count"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to process document: {str(e)}")
