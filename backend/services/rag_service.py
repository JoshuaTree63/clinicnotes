import json
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
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def analyze_with_openrouter(
    transcript: str, context_chunks: list[dict]
) -> dict:
    """Fallback: OpenRouter with Mixtral."""
    prompt = build_prompt(transcript, context_chunks)
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json",
            },
            json={
                "model": "mistralai/mixtral-8x7b-instruct",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 2000,
            },
            timeout=60.0,
        )
        data = response.json()
        text = data["choices"][0]["message"]["content"]
        # Strip markdown code fences if present
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
