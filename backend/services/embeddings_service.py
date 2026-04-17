import os
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

VECTORSTORE_DIR = os.getenv("VECTORSTORE_DIR", "./data/vectorstore")

# Local model — downloaded once, runs offline after that
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def get_embeddings():
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def get_or_create_vectorstore():
    """Load or create the ChromaDB vectorstore from disk."""
    return Chroma(
        persist_directory=VECTORSTORE_DIR,
        embedding_function=get_embeddings(),
    )


# Alias for callers that use the shorter name
get_vectorstore = get_or_create_vectorstore
