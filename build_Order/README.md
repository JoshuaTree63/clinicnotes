# 🧠 Therapy Session Analyzer — Master Plan

> A personal web app that transcribes therapy audio recordings, indexes academic therapy literature (PDFs), and analyzes your sessions through the lens of established schools of therapy (Freudian, CBT, Jungian, etc.).

---

## 📁 Project Documents

| # | File | Description |
|---|------|-------------|
| 1 | `01_architecture.md` | Full system architecture & data flow |
| 2 | `02_tech_stack.md` | All technologies, libraries, and APIs |
| 3 | `03_backend_setup.md` | Python FastAPI backend — setup & structure |
| 4 | `04_transcription.md` | Audio upload → transcription pipeline (Groq Whisper) |
| 5 | `05_pdf_indexing.md` | PDF ingestion, chunking & vector indexing (RAG) |
| 6 | `06_rag_analysis.md` | RAG query: analyzing transcripts against therapy literature |
| 7 | `07_frontend.md` | React (Vite) frontend — pages, components, UX flow |
| 8 | `08_env_and_keys.md` | Environment variables, API key management |
| 9 | `09_build_order.md` | Step-by-step build sequence |

---

## 🎯 What This App Does

1. **Upload** an audio recording of a therapy session
2. **Transcribe** it to text via Groq's Whisper API
3. **Store** the transcript as a session record
4. **Index** your academic therapy PDF library (one-time + on-demand)
5. **Analyze** the transcript using RAG — querying your therapy knowledge base
6. **Display** insights: which therapeutic concepts appeared, patterns, themes

---

## 🔑 APIs Used

| API | Purpose |
|-----|---------|
| **Groq** | Audio transcription (Whisper) + LLM analysis |
| **HuggingFace** | Embeddings for PDF vector indexing |
| **OpenRouter** | Fallback / alternative LLM for analysis |

---

## 🗂️ High-Level Folder Structure

```
therapy-analyzer/
├── backend/                  # Python FastAPI
│   ├── main.py
│   ├── routers/
│   │   ├── transcribe.py
│   │   ├── index.py
│   │   └── analyze.py
│   ├── services/
│   │   ├── groq_service.py
│   │   ├── embeddings_service.py
│   │   └── rag_service.py
│   ├── data/
│   │   ├── pdfs/             # Your uploaded therapy PDFs
│   │   ├── sessions/         # Stored transcripts (JSON)
│   │   └── vectorstore/      # ChromaDB persistent store
│   └── .env
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Upload.jsx
│   │   │   ├── Sessions.jsx
│   │   │   └── Analysis.jsx
│   │   ├── components/
│   │   └── api/              # Axios calls to backend
│   └── vite.config.js
│
└── README.md
```
