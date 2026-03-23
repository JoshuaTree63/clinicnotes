import os
import huggingface_hub
import torch

# --- Torch 2.6+ Security & Compatibility Shim ---
# Allow legacy TorchVersion objects in pyannote models
try:
    from torch.serialization import add_safe_globals
    from torch.torch_version import TorchVersion
    add_safe_globals([TorchVersion])
except ImportError:
    pass # Older torch versions

# pyannote-audio (v3.1.1) uses 'use_auth_token' which is rejected by newer hf_hub
_original_hf_hub_download = huggingface_hub.hf_hub_download

def _patched_hf_hub_download(*args, **kwargs):
    if "use_auth_token" in kwargs:
        kwargs["token"] = kwargs.pop("use_auth_token")
    return _original_hf_hub_download(*args, **kwargs)

huggingface_hub.hf_hub_download = _patched_hf_hub_download
# ---------------------------------------------

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import transcribe, index, analyze


app = FastAPI(title="Therapy Analyzer API", version="1.0.0")

# Allow React frontend (localhost:5173) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcribe.router, prefix="/api")
app.include_router(index.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")


REQUIRED_KEYS = ["GROQ_API_KEY"]


@app.on_event("startup")
def validate_env():
    missing = [k for k in REQUIRED_KEYS if not os.getenv(k)]
    if missing:
        print(f"⚠️  WARNING: Missing environment variables: {', '.join(missing)}")
    else:
        print("✅ All API keys loaded successfully")

    # Ensure data directories exist
    for d in ["./data/pdfs", "./data/sessions", "./data/vectorstore", "./data/temp"]:
        os.makedirs(d, exist_ok=True)
    print("✅ Data directories ready")


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
