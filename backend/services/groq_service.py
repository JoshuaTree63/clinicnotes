import os
import json
import re
import subprocess
import tempfile
import time
import shutil
from groq import Groq

# Initialize Groq client with API key from environment variables
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


# ---------------------------------------------------------------------------
# Diarization prompt — instructs the LLM to return structured speaker turns
# ---------------------------------------------------------------------------
DIARIZATION_SYSTEM_PROMPT = """You are diarizing a therapy session transcript. The recording is almost always between a therapist and a client (2 speakers total). Occasionally there may be 3 (e.g., couple's therapy).

HOW TO DISTINGUISH SPEAKERS (therapy-specific heuristics):
- The THERAPIST typically: asks open-ended questions ("How did that make you feel?", "Tell me more about..."), reflects feelings ("It sounds like..."), offers interpretations, speaks in shorter turns, uses clinical/neutral language.
- The CLIENT typically: shares personal experiences and emotions, speaks in longer monologues, uses first-person ("I felt...", "My mother..."), may digress, expresses distress or realization.
- Speaker 1 = the first person who speaks in the transcript. Stay consistent: once you assign a person to Speaker 1, every utterance from that same person MUST be labeled Speaker 1 through the entire transcript.

CRITICAL RULES:
- Preserve the transcript text EXACTLY as given — do not paraphrase, shorten, or reword anything.
- A turn ends ONLY when a different speaker starts. Long monologues stay as ONE turn — never split a single speaker's words into fake alternating turns.
- Default to exactly 2 speakers unless the content clearly indicates more people are present.
- If a section is ambiguous, prefer continuing the current speaker rather than switching.
- If PREVIOUS_CONTEXT is provided, the speaker labels there are FIXED — use them to determine who Speaker 1 and Speaker 2 are, and maintain that mapping in your output.

Respond with ONLY valid JSON in this exact shape:
{
  "speaker_count": 2,
  "turns": [
    { "speaker": "Speaker 1", "text": "..." },
    { "speaker": "Speaker 2", "text": "..." }
  ]
}"""


# ---------------------------------------------------------------------------
# Audio transcription (Whisper)
# ---------------------------------------------------------------------------
def transcribe_audio(file_path: str) -> str:
    """
    Sends an audio file to Groq's Whisper API.
    If the file is larger than 25MB, it automatically splits it into chunks using ffmpeg,
    transcribes each chunk, and joins the results.
    """
    # 25MB is Groq's limit. We'll use 20MB to be safe.
    MAX_SIZE_BYTES = 20 * 1024 * 1024

    file_size = os.path.getsize(file_path)

    if file_size <= MAX_SIZE_BYTES:
        return _send_to_whisper(file_path)

    # Large file - handle with chunking
    return _transcribe_large_file(file_path)


def _parse_retry_after_seconds(err_msg: str) -> float | None:
    """Extract 'Please try again in 1m38s' or '98.5s' from a Groq rate-limit error."""
    m = re.search(r"try again in\s+(?:(\d+)m)?\s*([\d.]+)s", err_msg)
    if not m:
        return None
    minutes = int(m.group(1)) if m.group(1) else 0
    seconds = float(m.group(2))
    return minutes * 60 + seconds


def _send_to_whisper(file_path: str, max_retries: int = 2) -> str:
    """Helper to send a single file to Whisper. Retries on rate-limit errors."""
    # Pass the basename explicitly — if we pass the raw file object, the SDK
    # uses its full path (e.g. "./data/temp/abc_recording.mp3") as the filename,
    # and Groq sometimes fails to detect the format from that, returning
    # "could not process file - is it a valid media file?".
    filename = os.path.basename(file_path)

    for attempt in range(max_retries + 1):
        try:
            with open(file_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    model="whisper-large-v3",
                    file=(filename, audio_file),
                    response_format="text",
                )
            return str(transcription).strip() if transcription else ""
        except Exception as e:
            msg = str(e)
            is_rate_limit = "rate_limit_exceeded" in msg or "429" in msg
            wait = _parse_retry_after_seconds(msg) if is_rate_limit else None

            if is_rate_limit and wait is not None and attempt < max_retries:
                # Add a small cushion so we don't retry right on the boundary
                wait_with_buffer = wait + 3
                print(
                    f"[Whisper] Rate limit hit for {filename}. "
                    f"Waiting {wait_with_buffer:.0f}s then retrying "
                    f"(attempt {attempt + 1}/{max_retries})..."
                )
                time.sleep(wait_with_buffer)
                continue

            print(f"Error in Whisper call for {file_path}: {e}")
            raise e

    # Should be unreachable, but keeps type checkers happy
    raise RuntimeError("Whisper call exhausted retries without raising")


def _is_valid_audio_chunk(chunk_path: str, min_bytes: int = 10_000) -> bool:
    """Skip chunks that are too small or lack valid audio magic bytes.
    ffmpeg -c copy can produce a tail chunk without valid MP3/container
    frames, which Whisper rejects as 'could not process file'."""
    try:
        size = os.path.getsize(chunk_path)
    except OSError:
        return False
    if size < min_bytes:
        return False
    try:
        with open(chunk_path, "rb") as f:
            head = f.read(16)
    except OSError:
        return False
    # Same magic-byte check as in the router
    if head.startswith(b"ID3") or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return True
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return True
    if head[4:8] == b"ftyp":
        return True
    if head.startswith(b"fLaC"):
        return True
    if head.startswith(b"OggS"):
        return True
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return True
    return False


def _extract_segments(response, offset: float = 0.0) -> list[dict]:
    """Normalize Groq verbose_json segments into [{start, end, text}]."""
    raw = getattr(response, "segments", None) or []
    out = []
    for s in raw:
        start = s["start"] if isinstance(s, dict) else getattr(s, "start", None)
        end = s["end"] if isinstance(s, dict) else getattr(s, "end", None)
        text = s["text"] if isinstance(s, dict) else getattr(s, "text", None)
        if start is None or end is None or text is None:
            continue
        out.append({"start": float(start) + offset, "end": float(end) + offset, "text": str(text).strip()})
    return out


def _send_to_whisper_verbose(file_path: str, offset: float = 0.0, max_retries: int = 2) -> list[dict]:
    """Send a single file to Whisper and return timestamped segments."""
    filename = os.path.basename(file_path)
    for attempt in range(max_retries + 1):
        try:
            with open(file_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model="whisper-large-v3",
                    file=(filename, audio_file),
                    response_format="verbose_json",
                )
            return _extract_segments(response, offset=offset)
        except Exception as e:
            msg = str(e)
            is_rate_limit = "rate_limit_exceeded" in msg or "429" in msg
            wait = _parse_retry_after_seconds(msg) if is_rate_limit else None
            if is_rate_limit and wait is not None and attempt < max_retries:
                wait_with_buffer = wait + 3
                print(f"[Whisper:verbose] Rate limit. Waiting {wait_with_buffer:.0f}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait_with_buffer)
                continue
            print(f"Error in Whisper verbose call for {file_path}: {e}")
            raise e
    raise RuntimeError("Whisper verbose call exhausted retries")


def transcribe_audio_with_segments(file_path: str) -> list[dict]:
    """
    Transcribes audio and returns timestamped segments:
        [{"start": float, "end": float, "text": str}, ...]

    Timestamps are in seconds, relative to the ORIGINAL file (chunk offsets
    are already applied), so they can be aligned with pyannote speaker spans.
    """
    MAX_SIZE_BYTES = 20 * 1024 * 1024
    file_size = os.path.getsize(file_path)
    if file_size <= MAX_SIZE_BYTES:
        return _send_to_whisper_verbose(file_path, offset=0.0)

    # Large-file path: split with ffmpeg, transcribe each chunk, offset timestamps
    CHUNK_SECONDS = 600
    temp_dir = tempfile.mkdtemp()
    try:
        ext = os.path.splitext(file_path)[1]
        chunk_pattern = os.path.join(temp_dir, "chunk_%03d" + ext)
        split_cmd = [
            "ffmpeg", "-i", file_path,
            "-f", "segment", "-segment_time", str(CHUNK_SECONDS),
            "-reset_timestamps", "1",
            "-c", "copy", chunk_pattern,
        ]
        subprocess.run(split_cmd, capture_output=True, check=True)
        chunks = sorted(
            os.path.join(temp_dir, f)
            for f in os.listdir(temp_dir)
            if f.startswith("chunk_")
        )
        all_segments: list[dict] = []
        for idx, chunk in enumerate(chunks):
            if not _is_valid_audio_chunk(chunk):
                size = os.path.getsize(chunk) if os.path.exists(chunk) else 0
                print(f"[Whisper:verbose] Skipping invalid chunk {os.path.basename(chunk)} ({size} bytes)")
                continue
            offset = idx * CHUNK_SECONDS
            all_segments.extend(_send_to_whisper_verbose(chunk, offset=offset))
        return all_segments
    finally:
        shutil.rmtree(temp_dir)


def _transcribe_large_file(file_path: str) -> str:
    """Splits a large file into chunks and transcribes them."""
    temp_dir = tempfile.mkdtemp()
    try:
        ext = os.path.splitext(file_path)[1]
        chunk_pattern = os.path.join(temp_dir, "chunk_%03d" + ext)

        # Split into 10-minute segments. -reset_timestamps makes each chunk
        # self-contained; -c copy avoids re-encoding for speed/quality.
        split_cmd = [
            "ffmpeg", "-i", file_path,
            "-f", "segment", "-segment_time", "600",
            "-reset_timestamps", "1",
            "-c", "copy", chunk_pattern,
        ]

        subprocess.run(split_cmd, capture_output=True, check=True)

        chunks = sorted(
            os.path.join(temp_dir, f)
            for f in os.listdir(temp_dir)
            if f.startswith("chunk_")
        )

        full_transcript = []
        for chunk in chunks:
            if not _is_valid_audio_chunk(chunk):
                size = os.path.getsize(chunk) if os.path.exists(chunk) else 0
                print(f"[Whisper] Skipping invalid/tiny chunk {os.path.basename(chunk)} ({size} bytes)")
                continue
            transcript = _send_to_whisper(chunk)
            if transcript:
                full_transcript.append(transcript)

        return " ".join(full_transcript)
    finally:
        shutil.rmtree(temp_dir)


# ---------------------------------------------------------------------------
# Diarization via LLM
# ---------------------------------------------------------------------------
def _diarize_chunk(chunk_text: str, context_turns: list[dict] | None = None) -> dict:
    """Send one chunk to the LLM. Optional context_turns anchors speaker identity across chunks."""
    user_parts = []
    if context_turns:
        user_parts.append("PREVIOUS_CONTEXT (already labeled — use these to maintain consistent Speaker 1/Speaker 2 identity. Do NOT repeat these turns in your output):")
        for t in context_turns:
            snippet = t["text"][:400]
            user_parts.append(f'{t["speaker"]}: {snippet}')
        user_parts.append("")
        user_parts.append("NEW TRANSCRIPT TO DIARIZE (label every turn; preserve text verbatim):")
    user_parts.append(chunk_text)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": DIARIZATION_SYSTEM_PROMPT},
            {"role": "user", "content": "\n".join(user_parts)},
        ],
        temperature=0.0,
        max_tokens=8000,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


def diarize_transcript(raw_transcript: str) -> dict:
    """
    Diarizes a raw transcript into speaker turns via LLM.

    Strategy:
      - For typical session lengths (<= ~12K words), run a SINGLE LLM call —
        this gives the best speaker consistency.
      - For longer transcripts, chunk at safe boundaries and carry the last
        two labeled turns forward as context so Speaker 1/2 identity is stable.

    Returns:
        {
            "speaker_count": int,
            "turns": [{"speaker": "Speaker 1", "text": "..."}, ...]
        }
    """
    if not raw_transcript or not raw_transcript.strip():
        return {
            "speaker_count": 1,
            "turns": [{"speaker": "Speaker 1", "text": raw_transcript or ""}],
        }

    words = raw_transcript.split()

    # Single-call path: handles almost all real sessions (~128K context on llama-3.3-70b)
    SINGLE_CALL_LIMIT = 12000
    CHUNK_WORDS = 6000  # conservative so output fits in max_tokens=8000

    if len(words) <= SINGLE_CALL_LIMIT:
        try:
            result = _diarize_chunk(raw_transcript)
            turns = result.get("turns") or []
            if turns:
                speakers = {t.get("speaker", "Speaker 1") for t in turns}
                return {"speaker_count": len(speakers), "turns": turns}
        except Exception as e:
            print(f"Diarization failed (single-call): {e}")
        # Safe fallback — one speaker, original text intact
        return {
            "speaker_count": 1,
            "turns": [{"speaker": "Speaker 1", "text": raw_transcript}],
        }

    # Multi-chunk path — pass last 2 turns as anchor to keep identity stable
    chunks = [" ".join(words[i:i + CHUNK_WORDS]) for i in range(0, len(words), CHUNK_WORDS)]
    all_turns: list[dict] = []

    for i, chunk in enumerate(chunks):
        context_turns = all_turns[-2:] if i > 0 and all_turns else None
        try:
            result = _diarize_chunk(chunk, context_turns=context_turns)
            turns = result.get("turns") or []
            if not turns:
                raise ValueError("LLM returned no turns")
            all_turns.extend(turns)
        except Exception as e:
            print(f"Diarization failed on chunk {i}: {e}")
            # Don't collapse the whole chunk into Speaker 1 — that hides the
            # rest of the session. Keep the last known speaker if we have one.
            last_speaker = all_turns[-1]["speaker"] if all_turns else "Speaker 1"
            all_turns.append({"speaker": last_speaker, "text": chunk})

    speakers = {t.get("speaker", "Speaker 1") for t in all_turns}
    return {"speaker_count": len(speakers), "turns": all_turns}


# ---------------------------------------------------------------------------
# Format diarized turns for LLM analysis input
# ---------------------------------------------------------------------------
def format_transcript_for_llm(diarized_turns: list[dict]) -> str:
    """
    Convert diarized turns into a readable dialogue format for the LLM.

    Output example:
        Speaker 1: How have you been feeling this week?
        Speaker 2: Honestly, pretty anxious...
    """
    return "\n".join(
        f"{turn['speaker']}: {turn['text']}"
        for turn in diarized_turns
    )


# ---------------------------------------------------------------------------
# Legacy function — kept for backwards compatibility but wraps diarize_transcript
# ---------------------------------------------------------------------------
def format_transcript_with_speakers(raw_transcript: str) -> str:
    """
    Legacy wrapper. Returns formatted string with speaker labels.
    New code should use diarize_transcript() instead.
    """
    result = diarize_transcript(raw_transcript)
    return format_transcript_for_llm(result["turns"])