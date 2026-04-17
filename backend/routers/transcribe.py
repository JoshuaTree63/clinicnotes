import os
import io
import re
import json
import uuid
import shutil
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.concurrency import run_in_threadpool
import logging
from services.groq_service import transcribe_audio, diarize_transcript

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

# Ensure these directories exist, using environment variables for paths
SESSIONS_DIR = os.getenv("SESSIONS_DIR", "./data/sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

TEMP_DIR = "./data/temp"  # Temporary storage for uploaded audio before transcription
os.makedirs(TEMP_DIR, exist_ok=True)


ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".webm", ".ogg", ".flac", ".mpga", ".mpeg"}


def _detect_audio_magic(head: bytes) -> str | None:
    """Return a format name if `head` matches known audio/video magic bytes, else None."""
    if head.startswith(b"ID3") or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "mp3"
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return "wav"
    if head[4:8] == b"ftyp":
        return "mp4/m4a"
    if head.startswith(b"fLaC"):
        return "flac"
    if head.startswith(b"OggS"):
        return "ogg"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm/matroska"
    return None


def _safe_filename(filename: str | None) -> str:
    """Sanitize to ASCII alphanum + dashes/underscores, preserving lowercase extension."""
    name, ext = os.path.splitext(filename or "audio")
    safe_name = re.sub(r"[^A-Za-z0-9_-]", "_", name).strip("_") or "audio"
    return f"{safe_name}{ext.lower()}"


@router.post("/transcribe")
async def transcribe_session(file: UploadFile = File(...)):
    """
    Uploads an audio file, transcribes it using Groq's Whisper API,
    diarizes speakers via LLM, and saves the session record.
    """
    # Validate by extension — browser-supplied content_type is inconsistent
    # (e.g. .wav may arrive as audio/wave, audio/x-wav, or audio/wav).
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            400,
            detail=f"Unsupported file type: '{ext or 'unknown'}'. Allowed: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}",
        )

    # Save uploaded file with an ASCII-safe name — non-ASCII or whitespace
    # characters in the filename can make Groq reject the upload.
    safe_name = _safe_filename(file.filename)
    temp_file_path = os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}_{safe_name}")
    try:
        with open(temp_file_path, "wb") as f:
            # Read in chunks to handle large files efficiently
            while contents := await file.read(1024 * 1024):  # Read 1MB chunks
                f.write(contents)

        # Sanity check: empty/tiny files will always fail at Groq
        file_size = os.path.getsize(temp_file_path)
        if file_size < 512:
            raise HTTPException(400, detail=f"Uploaded file is too small ({file_size} bytes) — is it a valid audio file?")

        # Verify the bytes on disk actually look like audio/video
        with open(temp_file_path, "rb") as f:
            head = f.read(16)
        detected = _detect_audio_magic(head)
        logger.info(
            f"Audio file saved to {temp_file_path} ({file_size} bytes, "
            f"ext={ext}, content_type={file.content_type}, detected_format={detected}, "
            f"magic={head[:8].hex()})"
        )
        if detected is None:
            raise HTTPException(
                400,
                detail=(
                    f"File does not look like a valid audio/video file "
                    f"(extension {ext}, first bytes: {head[:8].hex()}). "
                    "Try re-exporting as MP3 or WAV."
                ),
            )

        logger.info("Starting transcription...")

        # Transcribe the audio
        try:
            logger.info("Executing Whisper transcription...")
            raw_transcript = await run_in_threadpool(transcribe_audio, temp_file_path)

            logger.info("Transcription completed. Diarizing speakers...")
            diarization = await run_in_threadpool(diarize_transcript, raw_transcript)
            logger.info(f"Diarization completed. {diarization['speaker_count']} speakers detected.")
        except Exception as groq_err:
            logger.error(f"Groq API Error: {groq_err}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(groq_err)}")

        # Create session record with new schema
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        session_data = {
            "id": session_id,
            "date": datetime.now().isoformat(),
            "source": "audio",
            "filename": file.filename,
            "transcript_raw": raw_transcript,
            "transcript_diarized": diarization["turns"],
            "speaker_count": diarization["speaker_count"],
            "analysis": None
        }

        # Save session JSON
        try:
            session_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
            with open(session_path, "w", encoding="utf-8") as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)
            logger.info(f"Session saved to {session_path}")
        except Exception as save_err:
            logger.error(f"Error saving session data: {save_err}")

        return {
            "session_id": session_id,
            "source": "audio",
            "speaker_count": diarization["speaker_count"],
            "transcript_diarized": diarization["turns"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during transcription process: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@router.post("/upload-transcript")
async def upload_manual_transcript(file: UploadFile = File(...)):
    """
    Upload a .docx or .pdf file containing a transcript.
    Extracts text, diarizes speakers via LLM, and saves as a session.
    """
    filename = file.filename.lower()

    # Detect file type and extract text
    if filename.endswith(".pdf"):
        source_type = "manual_pdf"
        raw_text = await run_in_threadpool(_extract_text_from_pdf, file)
    elif filename.endswith(".docx"):
        source_type = "manual_docx"
        raw_text = await run_in_threadpool(_extract_text_from_docx, file)
    else:
        raise HTTPException(400, detail="Only .pdf and .docx files are supported")

    if not raw_text.strip():
        raise HTTPException(400, detail="Could not extract text from the uploaded file")

    # Diarize with LLM (same pipeline as audio)
    logger.info(f"Manual transcript uploaded ({source_type}). Diarizing speakers...")
    diarization = await run_in_threadpool(diarize_transcript, raw_text)
    logger.info(f"Diarization completed. {diarization['speaker_count']} speakers detected.")

    session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    session_data = {
        "id": session_id,
        "date": datetime.now().isoformat(),
        "source": source_type,
        "filename": file.filename,
        "transcript_raw": raw_text,
        "transcript_diarized": diarization["turns"],
        "speaker_count": diarization["speaker_count"],
        "analysis": None
    }

    session_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    with open(session_path, "w", encoding="utf-8") as f:
        json.dump(session_data, f, ensure_ascii=False, indent=2)

    logger.info(f"Manual transcript session saved to {session_path}")

    return {
        "session_id": session_id,
        "source": source_type,
        "speaker_count": diarization["speaker_count"],
        "transcript_diarized": diarization["turns"]
    }


def _extract_text_from_pdf(file: UploadFile) -> str:
    """Extract all text from a PDF file using PyMuPDF (fitz)."""
    import fitz
    contents = file.file.read()
    doc = fitz.open(stream=contents, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)


def _extract_text_from_docx(file: UploadFile) -> str:
    """Extract all text from a DOCX file using python-docx."""
    from docx import Document
    contents = file.file.read()
    doc = Document(io.BytesIO(contents))
    return "\n".join(para.text for para in doc.paragraphs if para.text.strip())