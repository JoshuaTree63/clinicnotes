import os
import json
import uuid
import shutil
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, concurrency
import logging
from services.groq_service import transcribe_audio

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

# Ensure these directories exist, using environment variables for paths
SESSIONS_DIR = os.getenv("SESSIONS_DIR", "./data/sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

TEMP_DIR = "./data/temp" # Temporary storage for uploaded audio before transcription
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/transcribe")
async def transcribe_session(file: UploadFile = File(...)):
    """
    Uploads an audio file, transcribes it using Groq's Whisper API,
    and saves the transcript as a session record.
    """
    # Validate file type
    allowed_content_types = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/webm"]
    if file.content_type not in allowed_content_types:
        raise HTTPException(400, detail=f"Unsupported file type: {file.content_type}. Allowed: {', '.join(allowed_content_types)}")

    # Save uploaded file temporarily
    # Add a UUID to prevent collisions if multiple files are uploaded at once
    temp_file_path = os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}_{file.filename}")
    try:
        with open(temp_file_path, "wb") as f:
            # Read in chunks to handle large files efficiently
            while contents := await file.read(1024 * 1024): # Read 1MB chunks
                f.write(contents)

        logger.info(f"Audio file saved to {temp_file_path}, starting transcription...")

        # Transcribe the audio
        # run_in_threadpool prevents the synchronous Groq call from blocking the server
        try:
            transcript = await concurrency.run_in_threadpool(transcribe_audio, temp_file_path)
            logger.info("Transcription completed successfully.")
        except Exception as groq_err:
            logger.error(f"Groq API Error: {groq_err}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(groq_err)}")

        # Create session record
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        session_data = {
            "id": session_id,
            "date": datetime.now().isoformat(),
            "filename": file.filename,
            "transcript": transcript,
            "analysis": None # Analysis will be added in a later step
        }

        # Save session JSON
        try:
            session_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
            with open(session_path, "w", encoding="utf-8") as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)
            logger.info(f"Session saved to {session_path}")
        except Exception as save_err:
            logger.error(f"Error saving session data: {save_err}")
            # Even if saving JSON fails locally, we can return the transcript
        
        return {"session_id": session_id, "transcript": transcript}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during transcription process: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)