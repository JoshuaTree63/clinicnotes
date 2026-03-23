# 02 — Tech Stack & Libraries

## Backend (Python)

| Library | Version | Purpose |
|---------|---------|---------|
| `fastapi` | latest | REST API framework |
| `uvicorn` | latest | ASGI server to run FastAPI |
| `python-multipart` | latest | File upload support in FastAPI |
| `groq` | latest | Groq SDK — Whisper transcription + LLM |
| `openai` | latest | OpenRouter uses OpenAI-compatible API |
| `langchain` | latest | PDF loading, text splitting, RAG chain |
| `langchain-community` | latest | ChromaDB integration, HuggingFace embeddings |
| `langchain-huggingface` | latest | HuggingFace embeddings wrapper |
| `chromadb` | latest | Local vector database |
| `pymupdf` (fitz) | latest | PDF text extraction |
| `sentence-transformers` | latest | Local embedding model |
| `python-dotenv` | latest | Load .env file |
| `httpx` | latest | Async HTTP client (OpenRouter fallback) |
| `pydantic` | v2 | Data validation / response schemas |

---

## Frontend (JavaScript)

| Library | Version | Purpose |
|---------|---------|---------|
| `react` | 18 | UI framework |
| `vite` | 5 | Build tool / dev server |
| `react-router-dom` | 6 | Page routing |
| `axios` | latest | HTTP calls to backend |
| `@tanstack/react-query` | 5 | Server state, loading/error handling |
| `react-dropzone` | latest | Drag-and-drop audio file uploads |
| `tailwindcss` | 3 | Utility CSS styling |
| `framer-motion` | latest | Page transitions, animation |
| `react-markdown` | latest | Render analysis text as markdown |
| `lucide-react` | latest | Icons |

---

## AI APIs

### Groq
- **Transcription**: `whisper-large-v3` model
  - Input: audio file (mp3, wav, m4a, webm)
  - Output: plain text transcript
- **LLM Analysis**: `llama-3.3-70b-versatile` or `mixtral-8x7b-32768`
  - Input: system prompt + context chunks + transcript
  - Output: structured analysis (JSON or markdown)

### HuggingFace
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2`
  - Runs **locally** via `sentence-transformers` library
  - No API call needed — just download once
  - 384-dimension vectors, fast and efficient

### OpenRouter (Fallback)
- Acts as a drop-in replacement for Groq LLM
- Uses OpenAI-compatible API format
- Model: `anthropic/claude-3-haiku` or `mistralai/mixtral-8x7b`
- Triggered if Groq returns an error

---

## Environment Variables (`.env`)

```env
# Groq
xai_api_key="xai-hB...

# HuggingFace (for private model access if needed)
HF_TOKEN=hf_...

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# App config
DATA_DIR=./data
SESSIONS_DIR=./data/sessions
PDF_DIR=./data/pdfs
VECTORSTORE_DIR=./data/vectorstore
```

All keys are loaded via `python-dotenv` on startup.

---

## Python Version

- **Python 3.11+** recommended
- Use a virtual environment: `python -m venv venv`

---

## Node Version

- **Node 20+** recommended
- Package manager: `npm` or `pnpm`
