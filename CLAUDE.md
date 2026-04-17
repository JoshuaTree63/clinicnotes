# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

ClinicNotes transcribes therapy audio recordings, indexes academic therapy literature (PDFs), and analyzes sessions using RAG (Retrieval-Augmented Generation) against psychotherapy schools (Freudian, CBT, Jungian, DBT, ACT, Humanistic, etc.).

## Running the Stack

**Backend** (FastAPI on port 8000):
```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
```

**Frontend** (React + Vite on port 5173):
```bash
cd frontend && npm run dev
```

Health check: `GET http://localhost:8000/health`  
API docs: `http://localhost:8000/docs`

No automated test suite — testing is done via Swagger UI or the frontend.

## Architecture

Three independent pipelines, all triggered from the frontend:

**1. Transcription** (`POST /api/transcribe`)  
Audio upload → Groq Whisper API (speech-to-text) → LLM diarization (assigns Speaker 1, Speaker 2…) → session JSON saved to `backend/data/sessions/{session_id}.json`

**2. PDF Indexing** (`POST /api/index`)  
Scans `backend/data/pdfs/` → PyMuPDF text extraction → LangChain chunking (size=800, overlap=100) → HuggingFace embeddings (`sentence-transformers/all-MiniLM-L6-v2`, runs locally) → ChromaDB stored in `backend/data/vectorstore/`

**3. RAG Analysis** (`POST /api/analyze`)  
Load session JSON → embed transcript → ChromaDB similarity search (top 6 chunks) → Groq `llama-3.3-70b` generates structured analysis → falls back to OpenRouter if Groq fails → analysis written back into the session JSON

## Session JSON Format

```json
{
  "id": "session_20240601_143022_a3f9b1",
  "date": "ISO timestamp",
  "source": "audio",
  "transcript_diarized": [
    {"speaker": "Speaker 1", "text": "..."},
    {"speaker": "Speaker 2", "text": "..."}
  ],
  "speaker_count": 2,
  "analysis": {
    "schools_detected": ["Psychoanalytic", "CBT"],
    "themes": ["attachment", "avoidance"],
    "summary": "...",
    "speaker_profiles": {},
    "notable_moments": [],
    "suggested_concepts": [],
    "literature_references": []
  }
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/transcribe` | Upload audio → transcribe + diarize |
| POST | `/api/upload-transcript` | Upload .docx/.pdf transcript |
| POST | `/api/index` | Index all PDFs in `/data/pdfs/` |
| GET | `/api/index/status` | Indexed chunk count |
| POST | `/api/analyze` | Analyze session via RAG |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/{id}` | Full session (transcript + analysis) |
| POST | `/api/sessions/{id}/transcript/override` | Replace transcript |

## Key Services (backend/services/)

- `groq_service.py` — `transcribe_audio()` and `diarize_transcript()` via Groq API
- `embeddings_service.py` — `get_or_create_vectorstore()` using ChromaDB + HuggingFace
- `rag_service.py` — `retrieve_context()`, `analyze_with_groq()`, `analyze_with_openrouter()` (fallback)

## Environment Variables

Stored in `backend/.env` (and root `.env`):
- `GROQ_API_KEY` — used for both Whisper transcription and LLM analysis
- `HF_TOKEN` — HuggingFace token for embedding model download
- `OPENROUTER_API_KEY` — fallback LLM if Groq fails
- `SESSIONS_DIR`, `PDF_DIR`, `VECTORSTORE_DIR` — data paths (defaults to `./data/*`)

## Frontend State

React Query manages all server state. The `frontend/src/api/client.js` file is the single source of truth for all API calls — add new endpoints there. Pages are in `src/pages/`, reusable UI in `src/components/`.

## Data Directories (gitignored)

- `backend/data/pdfs/` — drop therapy literature PDFs here before indexing
- `backend/data/sessions/` — auto-generated session JSONs
- `backend/data/vectorstore/` — ChromaDB persistent storage (binary, `chroma.sqlite3`)
- `backend/data/temp/` — temporary audio files during transcription
