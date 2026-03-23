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
        embedding_function=get_embeddings(),
    )


def get_or_create_vectorstore():
    """Create or load the ChromaDB vectorstore."""
    return Chroma(
        persist_directory=VECTORSTORE_DIR,
        embedding_function=get_embeddings(),
    )
