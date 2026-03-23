import os

from fastapi import APIRouter
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
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
        separators=["\n\n", "\n", ". ", " "],
    )
    chunks = splitter.split_documents(all_docs)

    # Store in ChromaDB
    vectorstore = get_or_create_vectorstore()
    vectorstore.add_documents(chunks)

    return {
        "message": "Indexing complete",
        "pdfs_processed": len(pdf_files),
        "chunks_stored": len(chunks),
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
