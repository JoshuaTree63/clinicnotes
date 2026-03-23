# 08 — Environment Variables & API Key Management

## Overview

All API keys and configuration are stored in a `.env` file in the `backend/` directory.  
The Python `python-dotenv` library loads them at startup.  
**Never commit `.env` to git.**

---

## `.env` Template

```env
# ─────────────────────────────────────────
# GROQ
# Get your key at: https://console.groq.com
# ─────────────────────────────────────────
GROQ_API_KEY=gsk_...

# ─────────────────────────────────────────
# HUGGINGFACE
# Get your key at: https://huggingface.co/settings/tokens
# Only needed if using private/gated models
# The default embedding model (all-MiniLM-L6-v2) is public and works without a key
# ─────────────────────────────────────────
HUGGINGFACE_API_KEY=hf_...

# ─────────────────────────────────────────
# OPENROUTER (fallback LLM)
# Get your key at: https://openrouter.ai/keys
# ─────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-...

# ─────────────────────────────────────────
# DATA PATHS (relative to backend/)
# ─────────────────────────────────────────
SESSIONS_DIR=./data/sessions
PDF_DIR=./data/pdfs
VECTORSTORE_DIR=./data/vectorstore
```

---

## How Keys Are Loaded in Python

In every service file that needs a key:

```python
import os
from dotenv import load_dotenv

load_dotenv()  # reads .env from current directory

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
```

In `main.py`, `load_dotenv()` is called once at startup — this is enough for all routers and services.

---

## `.gitignore` (backend)

```
.env
data/pdfs/
data/sessions/
data/vectorstore/
__pycache__/
venv/
*.pyc
```

---

## API Key Responsibilities

| Key | Used For | When |
|-----|----------|------|
| `GROQ_API_KEY` | Whisper transcription + LLM analysis | Every transcription & analysis call |
| `HUGGINGFACE_API_KEY` | Embedding model access (if private) | Only if you switch to a private model |
| `OPENROUTER_API_KEY` | Fallback LLM when Groq fails | Only on Groq errors |

---

## API Costs (Approximate)

| Service | Price |
|---------|-------|
| Groq Whisper | ~$0.111 / hour of audio |
| Groq LLaMA 3.3 70B | ~$0.59 / 1M input tokens |
| HuggingFace all-MiniLM | **Free** (runs locally) |
| OpenRouter Mixtral fallback | ~$0.24 / 1M tokens |

For personal use (a few sessions/week), total cost is likely **under $1/month**.

---

## Key Validation on Startup (Optional Enhancement)

Add to `main.py`:

```python
import os
from dotenv import load_dotenv

load_dotenv()

REQUIRED_KEYS = ["GROQ_API_KEY", "OPENROUTER_API_KEY"]

@app.on_event("startup")
def validate_env():
    missing = [k for k in REQUIRED_KEYS if not os.getenv(k)]
    if missing:
        print(f"⚠️  WARNING: Missing environment variables: {', '.join(missing)}")
    else:
        print("✅ All API keys loaded successfully")
```
