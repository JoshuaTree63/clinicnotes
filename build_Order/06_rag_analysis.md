# 06 — RAG Analysis Pipeline (Session → Therapy Literature)

## Goal
Take a stored session transcript, retrieve the most relevant chunks from the indexed therapy PDFs, and use Groq (or OpenRouter as fallback) to generate a structured therapeutic analysis.

---

## `services/rag_service.py`

```python
import os
import httpx
from groq import Groq
from services.embeddings_service import get_vectorstore

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are an expert clinical analyst with deep knowledge of multiple schools of psychotherapy including:
- Psychoanalytic / Freudian theory
- Cognitive Behavioral Therapy (CBT)
- Jungian / Analytical Psychology
- Dialectical Behavior Therapy (DBT)
- Acceptance and Commitment Therapy (ACT)
- Humanistic / Person-Centered therapy

You will be given:
1. Excerpts from academic therapy literature (CONTEXT)
2. A transcript of a therapy session (SESSION)

Your task is to analyze the session transcript in light of the provided literature.
Respond in the following JSON structure:

{
  "schools_detected": ["list of therapy schools most relevant to this session"],
  "themes": ["key psychological themes identified"],
  "summary": "2-3 sentence plain-language summary of the session",
  "notable_moments": [
    { "quote": "exact or paraphrased moment from transcript", "interpretation": "clinical interpretation" }
  ],
  "suggested_concepts": ["therapy concepts the client/therapist touched on"],
  "literature_references": ["source PDF and concept that relates to this session"]
}

Be thoughtful, empathetic, and grounded in the provided literature."""


def retrieve_context(query: str, k: int = 6) -> list[dict]:
    """Retrieve top-k relevant chunks from ChromaDB."""
    vectorstore = get_vectorstore()
    results = vectorstore.similarity_search(query, k=k)
    return [
        {"text": doc.page_content, "source": doc.metadata.get("source", "unknown")}
        for doc in results
    ]


def build_prompt(transcript: str, context_chunks: list[dict]) -> str:
    context_text = "\n\n---\n\n".join(
        [f"[Source: {c['source']}]\n{c['text']}" for c in context_chunks]
    )
    return f"""CONTEXT (from therapy literature):
{context_text}

---

SESSION TRANSCRIPT:
{transcript}

---

Please provide your structured JSON analysis of this session based on the literature above."""


def analyze_with_groq(transcript: str, context_chunks: list[dict]) -> dict:
    prompt = build_prompt(transcript, context_chunks)
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=2000,
        response_format={"type": "json_object"}  # force JSON output
    )
    import json
    return json.loads(response.choices[0].message.content)


async def analyze_with_openrouter(transcript: str, context_chunks: list[dict]) -> dict:
    """Fallback: OpenRouter with Claude Haiku or Mixtral."""
    import json
    prompt = build_prompt(transcript, context_chunks)
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json"
            },
            json={
                "model": "mistralai/mixtral-8x7b-instruct",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 2000
            },
            timeout=60.0
        )
        data = response.json()
        text = data["choices"][0]["message"]["content"]
        # Strip markdown code fences if present
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
```

---

## `routers/analyze.py`

```python
import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.rag_service import retrieve_context, analyze_with_groq, analyze_with_openrouter

router = APIRouter()
SESSIONS_DIR = os.getenv("SESSIONS_DIR", "./data/sessions")


class AnalyzeRequest(BaseModel):
    session_id: str


@router.post("/analyze")
async def analyze_session(request: AnalyzeRequest):
    session_path = os.path.join(SESSIONS_DIR, f"{request.session_id}.json")
    if not os.path.exists(session_path):
        raise HTTPException(404, detail="Session not found")

    with open(session_path, "r", encoding="utf-8") as f:
        session = json.load(f)

    transcript = session.get("transcript", "")
    if not transcript:
        raise HTTPException(400, detail="Session has no transcript to analyze")

    # Retrieve relevant PDF chunks
    context_chunks = retrieve_context(transcript)
    if not context_chunks:
        raise HTTPException(400, detail="No indexed documents found. Run /api/index first.")

    # Try Groq first, fall back to OpenRouter
    try:
        analysis = analyze_with_groq(transcript, context_chunks)
    except Exception as groq_error:
        try:
            analysis = await analyze_with_openrouter(transcript, context_chunks)
        except Exception as openrouter_error:
            raise HTTPException(503, detail=f"Both Groq and OpenRouter failed: {str(openrouter_error)}")

    # Save analysis back to session
    session["analysis"] = analysis
    with open(session_path, "w", encoding="utf-8") as f:
        json.dump(session, f, ensure_ascii=False, indent=2)

    return {"session_id": request.session_id, "analysis": analysis}


@router.get("/sessions")
def list_sessions():
    """List all stored session records."""
    sessions = []
    for fname in sorted(os.listdir(SESSIONS_DIR), reverse=True):
        if fname.endswith(".json"):
            with open(os.path.join(SESSIONS_DIR, fname), "r") as f:
                s = json.load(f)
                sessions.append({
                    "id": s["id"],
                    "date": s["date"],
                    "filename": s.get("filename"),
                    "has_analysis": s["analysis"] is not None
                })
    return sessions


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    if not os.path.exists(path):
        raise HTTPException(404, detail="Session not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
```

---

## Analysis Response Example

```json
{
  "schools_detected": ["Psychoanalytic", "CBT"],
  "themes": ["attachment anxiety", "avoidance", "self-criticism", "transference"],
  "summary": "The session explores the client's recurring pattern of avoidance in relationships, which the therapist connects to early attachment disruptions. CBT techniques around cognitive restructuring were introduced.",
  "notable_moments": [
    {
      "quote": "I always pull away when things get too close",
      "interpretation": "Classic avoidant attachment pattern; may reflect Bowlby's anxious-avoidant framework"
    }
  ],
  "suggested_concepts": ["attachment theory", "cognitive distortions", "defense mechanisms"],
  "literature_references": [
    "freud_introductory_lectures.pdf — defense mechanisms chapter",
    "beck_cognitive_therapy.pdf — automatic negative thoughts"
  ]
}
```

---

## Fallback Logic

```
POST /api/analyze
        │
        ▼
Try Groq (llama-3.3-70b)
        │
   ┌────┴─────┐
 success    failure
   │            │
   ▼            ▼
Return      Try OpenRouter (Mixtral)
result           │
            ┌────┴─────┐
          success    failure
            │            │
            ▼            ▼
          Return       503 error
          result       with message
```
