import json
import os
import shutil
import uuid
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from services.groq_service import transcribe_audio

router = APIRouter()

SESSIONS_DIR = os.getenv("SESSIONS_DIR", "./data/sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

TEMP_DIR = "./data/temp"
os.makedirs(TEMP_DIR, exist_ok=True)


import threading
from fastapi import APIRouter, File, HTTPException, UploadFile, Form

transcription_tasks = {}

def process_transcription(job_id: str, temp_path: str, filename: str, language: str):
    def progress_callback(completed, total):
        transcription_tasks[job_id]["progress"] = {
            "completed": completed,
            "total": total
        }
        
    try:
        # Transcribe
        transcript = transcribe_audio(temp_path, language=language, progress_callback=progress_callback)

        # Create session record
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        session = {
            "id": session_id,
            "date": datetime.now().isoformat(),
            "filename": filename,
            "transcript": transcript,
            "analysis": None,
        }

        # Save session JSON
        session_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        with open(session_path, "w", encoding="utf-8") as f:
            json.dump(session, f, ensure_ascii=False, indent=2)

        transcription_tasks[job_id]["status"] = "completed"
        transcription_tasks[job_id]["result"] = {
            "session_id": session_id,
            "transcript": transcript
        }

    except Exception as e:
        transcription_tasks[job_id]["status"] = "error"
        transcription_tasks[job_id]["error"] = str(e)
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/transcribe")
def transcribe_session(file: UploadFile = File(...), language: str = Form("he")):
    # Validate file type
    allowed = [
        "audio/mpeg",
        "audio/wav",
        "audio/mp4",
        "audio/x-m4a",
        "audio/webm",
        "audio/mp3",
        "audio/x-wav",
        "audio/wave",
    ]
    if file.content_type not in allowed:
        raise HTTPException(
            400, detail=f"Unsupported file type: {file.content_type}"
        )

    # Save uploaded file temporarily
    temp_path = os.path.join(TEMP_DIR, file.filename)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    job_id = str(uuid.uuid4())
    transcription_tasks[job_id] = {
        "status": "processing",
        "progress": {"completed": 0, "total": 0},
        "result": None,
        "error": None
    }
    
    thread = threading.Thread(target=process_transcription, args=(job_id, temp_path, file.filename, language))
    thread.start()
    
    return {"job_id": job_id}

@router.get("/transcribe/status/{job_id}")
def get_transcribe_status(job_id: str):
    if job_id not in transcription_tasks:
        raise HTTPException(404, detail="Job not found")
    return transcription_tasks[job_id]
