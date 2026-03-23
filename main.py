from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from transcribe_hebrew import AppConfig


cfg = AppConfig()
UPLOAD_DIR: Path = cfg.audio_dir
SUPPORTED_EXT = {ext.lower() for ext in cfg.supported_ext}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


app = FastAPI(
    title="ClinicNotes Audio Uploader",
    description="Upload audio files to the transcription input folder.",
    version="1.0.0",
)


origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _sanitize_filename(filename: str) -> str:
    name = Path(filename).name  # strip any path components
    # Replace spaces and problematic chars
    safe = "".join(c if c.isalnum() or c in {"-", "_", "."} else "_" for c in name)
    return safe or "audio"


@app.post("/upload-audio")
async def upload_audio(
    file: Annotated[UploadFile, File(..., description="Audio file to upload")],
) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXT:
        allowed = ", ".join(sorted(SUPPORTED_EXT))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed extensions: {allowed}",
        )

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_name = _sanitize_filename(file.filename)
    stored_name = f"{timestamp}__{safe_name}"
    dest_path = UPLOAD_DIR / stored_name

    try:
        with dest_path.open("wb") as out:
            # Read in chunks to avoid loading whole file into memory
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    except Exception as exc:  # pragma: no cover - defensive
        if dest_path.exists():
            dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Failed to save file.") from exc

    return {
        "message": "File uploaded successfully.",
        "original_filename": file.filename,
        "stored_filename": stored_name,
        "relative_path": dest_path.name,
    }


if __name__ == "__main__":
    # Convenience for local debugging:
    #   python main.py
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

