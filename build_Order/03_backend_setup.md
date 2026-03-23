# 03 — Backend Setup (FastAPI)

## Goal
Bootstrap the Python FastAPI backend with folder structure, config loading, and a health-check endpoint.

---

## Step-by-Step Setup

### 1. Create project folder & virtual environment

```bash
mkdir therapy-analyzer && cd therapy-analyzer
mkdir backend && cd backend
python -m venv venv
source venv/bin/activate       # Mac/Linux
# venv\Scripts\activate        # Windows
```

### 2. Install dependencies

```bash
pip install fastapi uvicorn python-multipart groq openai \
  langchain langchain-community langchain-huggingface \
  chromadb pymupdf sentence-transformers \
  python-dotenv httpx pydantic
```

Save them:
```bash
pip freeze > requirements.txt
```

### 3. Create folder structure

```bash
mkdir -p routers services data/pdfs data/sessions data/vectorstore
touch main.py .env routers/__init__.py services/__init__.py
touch routers/transcribe.py routers/index.py routers/analyze.py
touch services/groq_service.py services/embeddings_service.py services/rag_service.py
```

### 4. `main.py` — App entry point

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import transcribe, index, analyze

load_dotenv()

app = FastAPI(title="Therapy Analyzer API", version="1.0.0")

# Allow React frontend (localhost:5173) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcribe.router, prefix="/api")
app.include_router(index.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}
```

### 5. Run the backend

```bash
uvicorn main:app --reload --port 8000
```

Visit: http://localhost:8000/health → should return `{"status": "ok"}`

Visit: http://localhost:8000/docs → auto-generated Swagger UI

---

## Folder Structure After Setup

```
backend/
├── main.py
├── .env
├── requirements.txt
├── routers/
│   ├── __init__.py
│   ├── transcribe.py       ← Step 04
│   ├── index.py            ← Step 05
│   └── analyze.py          ← Step 06
├── services/
│   ├── __init__.py
│   ├── groq_service.py     ← Step 04
│   ├── embeddings_service.py ← Step 05
│   └── rag_service.py      ← Step 06
└── data/
    ├── pdfs/               ← drop your PDFs here
    ├── sessions/           ← transcripts saved here
    └── vectorstore/        ← ChromaDB persists here
```

---

## Notes

- The `.env` file is **never committed** to git — add it to `.gitignore`
- All `data/` subdirectories are also excluded from git (they contain personal data)
- CORS is set to allow only localhost:5173 (Vite default port)
