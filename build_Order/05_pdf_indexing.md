# 05 — PDF Indexing Pipeline (RAG Knowledge Base)

## Goal
Load all academic therapy PDFs from `/data/pdfs/`, extract their text, split into chunks, embed with HuggingFace, and store in a local ChromaDB vector database. This is the **knowledge base** your analysis queries against.

---

## Concept: Why RAG?

RAG (Retrieval-Augmented Generation) means:
1. Your therapy PDFs are **pre-indexed** as vector embeddings
2. When analyzing a session, the transcript is used as a **query**
3. The most **semantically relevant chunks** from the PDFs are retrieved
4. Those chunks are injected into the LLM prompt as context
5. The LLM analyzes the session **grounded in actual therapy literature**

This means the AI's analysis references Freud, Beck, Jung, etc. **based on text you provided**, not just its training data.

---

## `services/embeddings_service.py`

```python
import os
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

VECTORSTORE_DIR = os.getenv("VECTORSTORE_DIR", "./data/vectorstore")

# Local model — downloaded once, runs offline after that
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def get_embeddings():
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

def get_vectorstore():
    """Load existing ChromaDB vectorstore from disk."""
    return Chroma(
        persist_directory=VECTORSTORE_DIR,
        embedding_function=get_embeddings()
    )

def get_or_create_vectorstore():
    """Create or load the ChromaDB vectorstore."""
    return Chroma(
        persist_directory=VECTORSTORE_DIR,
        embedding_function=get_embeddings()
    )
```

---

## `routers/index.py`

```python
import os
from fastapi import APIRouter
from langchain_community.document_loaders import PyMuPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from services.embeddings_service import get_or_create_vectorstore

router = APIRouter()

PDF_DIR = os.getenv("PDF_DIR", "./data/pdfs")

@router.post("/index")
def index_pdfs():
    """
    Scan all PDFs in /data/pdfs/, chunk them, embed, and store in ChromaDB.
    Can be called again when new PDFs are added.
    """
    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]
    if not pdf_files:
        return {"message": "No PDFs found in /data/pdfs/", "indexed": 0}

    all_docs = []
    for filename in pdf_files:
        path = os.path.join(PDF_DIR, filename)
        loader = PyMuPDFLoader(path)
        pages = loader.load()  # each page = one Document
        for doc in pages:
            doc.metadata["source"] = filename  # track which PDF
        all_docs.extend(pages)

    # Split into smaller chunks for better retrieval
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " "]
    )
    chunks = splitter.split_documents(all_docs)

    # Store in ChromaDB
    vectorstore = get_or_create_vectorstore()
    vectorstore.add_documents(chunks)

    return {
        "message": "Indexing complete",
        "pdfs_processed": len(pdf_files),
        "chunks_stored": len(chunks)
    }

@router.get("/index/status")
def index_status():
    """Check how many chunks are currently indexed."""
    try:
        vectorstore = get_or_create_vectorstore()
        count = vectorstore._collection.count()
        return {"indexed_chunks": count, "ready": count > 0}
    except Exception:
        return {"indexed_chunks": 0, "ready": False}
```

---

## Chunk Strategy

```
Raw PDF page (e.g. 3000 chars)
        │
        ▼
RecursiveCharacterTextSplitter
  chunk_size    = 800 chars  (~150 words)
  chunk_overlap = 100 chars  (context continuity)
        │
        ▼
~4-5 chunks per page
Each chunk: { text, source: "freud_intro.pdf", page: 3 }
        │
        ▼
HuggingFace all-MiniLM-L6-v2
→ 384-dim vector per chunk
        │
        ▼
ChromaDB stores: vector + text + metadata
```

---

## How to Add New PDFs

1. Drop new `.pdf` files into `backend/data/pdfs/`
2. Call `POST /api/index` from the frontend or via curl
3. New chunks are added to ChromaDB (existing ones are kept)

```bash
curl -X POST http://localhost:8000/api/index
```

---

## Recommended PDFs to Start With

Suggested academic sources (freely available):
- Freud — *Introductory Lectures on Psycho-Analysis*
- Aaron Beck — foundational CBT papers
- Carl Jung — *Psychological Types* excerpts
- DBT overview papers
- ACT (Acceptance & Commitment Therapy) introductions

Keep each PDF focused — the more specific, the better the retrieval quality.

---

## ChromaDB Notes

- Data is saved to `./data/vectorstore/` on disk
- Persists between server restarts — no need to re-index each time
- To **reset** the index: delete `./data/vectorstore/` and re-run `/api/index`
- Collection name: `"therapy_literature"` (default)
