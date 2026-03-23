# 01 — System Architecture & Data Flow

## Overview

The app is split into two separate processes:
- A **Python FastAPI backend** that handles all AI processing, file storage, and API calls
- A **React (Vite) frontend** that provides the UI and communicates with the backend via REST

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React/Vite)                      │
│                                                                   │
│   [Upload Audio]  →  [Sessions List]  →  [Analysis View]        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (REST API)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI / Python)                    │
│                                                                   │
│   /transcribe  ──►  Groq Whisper API  ──►  saves transcript.json│
│                                                                   │
│   /index       ──►  PDF Loader                                   │
│                      → chunk text                                 │
│                      → HuggingFace Embeddings                    │
│                      → ChromaDB (vectorstore)                    │
│                                                                   │
│   /analyze     ──►  RAG pipeline:                                │
│                      → embed transcript query                     │
│                      → retrieve relevant PDF chunks               │
│                      → Groq LLM (or OpenRouter fallback)         │
│                      → structured analysis response              │
└──────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        [data/pdfs/]  [data/sessions/]  [data/vectorstore/]
         Raw PDFs      JSON transcripts   ChromaDB on disk
```

---

## Data Flow — Step by Step

### Flow 1: Transcription

```
User uploads .mp3 / .wav / .m4a
        │
        ▼
POST /api/transcribe
        │
        ▼
Backend saves file temporarily
        │
        ▼
Groq Whisper API (whisper-large-v3)
        │
        ▼
Returns transcript text
        │
        ▼
Saved as /data/sessions/{timestamp}.json
{
  "id": "session_20241201_1430",
  "date": "2024-12-01",
  "raw_audio": "session_20241201.mp3",
  "transcript": "Today we talked about...",
  "analysis": null   ← filled in later
}
        │
        ▼
Frontend displays transcript + "Analyze" button
```

---

### Flow 2: PDF Indexing (one-time setup, re-run when adding PDFs)

```
User places PDFs in /data/pdfs/ folder
        │
        ▼
POST /api/index
        │
        ▼
Backend scans all PDFs in /data/pdfs/
        │
        ▼
PyMuPDF extracts raw text per page
        │
        ▼
LangChain RecursiveCharacterTextSplitter
(chunk_size=800, chunk_overlap=100)
        │
        ▼
HuggingFace Embeddings
(model: sentence-transformers/all-MiniLM-L6-v2)
        │
        ▼
ChromaDB stores vectors + metadata
{ source: "freud_intro.pdf", page: 12, chunk: "..." }
        │
        ▼
Returns: "Indexed N chunks from M documents"
```

---

### Flow 3: Analysis (RAG)

```
User clicks "Analyze" on a session
        │
        ▼
POST /api/analyze  { session_id: "..." }
        │
        ▼
Load transcript from sessions JSON
        │
        ▼
Embed transcript as a query vector
        │
        ▼
ChromaDB similarity search
→ top 6 most relevant chunks from therapy PDFs
        │
        ▼
Build prompt:
  SYSTEM: "You are a clinical analyst versed in [Freudian, CBT, Jungian...] therapy..."
  CONTEXT: [retrieved PDF chunks]
  USER: "Analyze this session: {transcript}"
        │
        ▼
Groq LLM (llama3-70b or mixtral)
  (fallback: OpenRouter if Groq fails)
        │
        ▼
Structured response:
{
  "schools_detected": ["Psychoanalytic", "CBT"],
  "themes": ["attachment", "avoidance", "transference"],
  "summary": "...",
  "notable_moments": [...],
  "suggested_reading": ["freud_intro.pdf p.12", ...]
}
        │
        ▼
Saved back into sessions JSON under "analysis"
        │
        ▼
Frontend renders the analysis dashboard
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Vector DB | ChromaDB (local) | No cloud needed, persists to disk, zero cost |
| Embeddings | HuggingFace (local model) | Free, private, no API cost for indexing |
| Transcription | Groq Whisper | Very fast, accurate, cheap |
| LLM | Groq primary, OpenRouter fallback | Speed + reliability fallback |
| Storage | Local JSON files | Simple, no DB setup needed for personal use |
| Backend | FastAPI | Fast, async, great for file uploads |
| Frontend | React + Vite | Fast dev experience, component model |
