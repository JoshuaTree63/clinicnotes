# 04 — Audio Transcription Pipeline (Groq Whisper)

## Goal
Accept an audio file upload from the frontend, send it to Groq's Whisper API, save the resulting transcript as a JSON session file, and return it to the frontend.

---

## Supported Audio Formats
`mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, `webm`  
Max file size: **25 MB** (Groq limit for Whisper)

---

## `services/groq_service.py`

```python
import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def transcribe_audio(file_path: str, language: str = "en") -> str:
    """
    Send audio file to Groq Whisper and return transcript text.
    """
    with open(file_path, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=audio_file,
            language=language,
            response_format="text"
        )
    return transcription  # returns plain string
```

---

## `routers/transcribe.py`

```python
import os
import json
import uuid
import shutil
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.groq_service import transcribe_audio

router = APIRouter()

SESSIONS_DIR = os.getenv("SESSIONS_DIR", "./data/sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

TEMP_DIR = "./data/temp"
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/transcribe")
async def transcribe_session(file: UploadFile = File(...)):
    # Validate file type
    allowed = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/webm"]
    if file.content_type not in allowed:
        raise HTTPException(400, detail=f"Unsupported file type: {file.content_type}")

    # Save uploaded file temporarily
    temp_path = os.path.join(TEMP_DIR, file.filename)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        # Transcribe
        transcript = transcribe_audio(temp_path)

        # Create session record
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        session = {
            "id": session_id,
            "date": datetime.now().isoformat(),
            "filename": file.filename,
            "transcript": transcript,
            "analysis": None
        }

        # Save session JSON
        session_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        with open(session_path, "w", encoding="utf-8") as f:
            json.dump(session, f, ensure_ascii=False, indent=2)

        return {"session_id": session_id, "transcript": transcript}

    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
```

---

## What Happens in the Frontend (Preview)

```
User drags audio file onto dropzone
        ↓
POST /api/transcribe  (multipart/form-data)
        ↓
Loading spinner: "Transcribing your session..."
        ↓
Response: { session_id, transcript }
        ↓
Display transcript in scrollable text area
Show "Analyze Session" button
```

---

## Session JSON Schema

```json
{
  "id": "session_20241201_143022_a3f9b1",
  "date": "2024-12-01T14:30:22.123456",
  "filename": "therapy_dec1.mp3",
  "transcript": "Today we started by discussing...",
  "analysis": null
}
```

`analysis` is `null` until the user runs the RAG analysis (Step 06).

---

## Error Handling

| Error | Response |
|-------|----------|
| Wrong file type | 400 — "Unsupported file type" |
| File > 25MB | 400 from Groq — surface message to user |
| Groq API down | 503 — "Transcription service unavailable" |
| No API key | 500 — "GROQ_API_KEY not configured" |

---

## Testing the Endpoint

```bash
curl -X POST http://localhost:8000/api/transcribe \
  -F "file=@./my_session.mp3"
```

Or use the Swagger UI at http://localhost:8000/docs
