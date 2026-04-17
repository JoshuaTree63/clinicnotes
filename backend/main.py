from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables BEFORE importing routers/services
load_dotenv()

from routers import transcribe, index, analyze

app = FastAPI(title="Therapy Analyzer API", version="1.0.0")

# Allow React frontend (localhost:5173) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175",
        "http://localhost:5176", "http://127.0.0.1:5176",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(transcribe.router, prefix="/api")
app.include_router(index.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}