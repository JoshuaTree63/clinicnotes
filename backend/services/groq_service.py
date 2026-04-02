import os
import json
import subprocess
import tempfile
import shutil
from groq import Groq

# Initialize Groq client with API key from environment variables
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


# ---------------------------------------------------------------------------
# Diarization prompt — instructs the LLM to return structured speaker turns
# ---------------------------------------------------------------------------
DIARIZATION_SYSTEM_PROMPT = """
You are a transcript analyst. You will receive a raw therapy session transcript.
Your job is to identify and separate distinct speakers.

Rules:
- Label speakers as "Speaker 1", "Speaker 2", etc. (never invent names or roles)
- Speaker 1 is always the first person to speak
- Split the transcript into speaker turns — a turn ends when a different speaker begins
- Keep each turn's text exactly as it appears in the transcript (do not paraphrase)
- If you cannot reliably distinguish speakers, group everything under "Speaker 1"

Respond ONLY with a valid JSON object in this exact format:
{
  "speaker_count": 2,
  "turns": [
    { "speaker": "Speaker 1", "text": "..." },
    { "speaker": "Speaker 2", "text": "..." }
  ]
}
"""


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


def _send_to_whisper(file_path: str) -> str:
    """Helper to send a single file to Whisper."""
    try:
        with open(file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_file,
                response_format="text"
            )
        return str(transcription).strip() if transcription else ""
    except Exception as e:
        print(f"Error in Whisper call for {file_path}: {e}")
        raise e


def _transcribe_large_file(file_path: str) -> str:
    """Splits a large file into chunks and transcribes them."""
    temp_dir = tempfile.mkdtemp()
    try:
        ext = os.path.splitext(file_path)[1]
        chunk_pattern = os.path.join(temp_dir, "chunk_%03d" + ext)

        # Split into 10 minute segments (600 seconds)
        split_cmd = [
            "ffmpeg", "-i", file_path,
            "-f", "segment", "-segment_time", "600",
            "-c", "copy", chunk_pattern
        ]

        subprocess.run(split_cmd, capture_output=True, check=True)

        chunks = sorted([os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.startswith("chunk_")])

        full_transcript = []
        for chunk in chunks:
            transcript = _send_to_whisper(chunk)
            if transcript:
                full_transcript.append(transcript)

        return " ".join(full_transcript)
    finally:
        shutil.rmtree(temp_dir)


# ---------------------------------------------------------------------------
# Diarization via LLM
# ---------------------------------------------------------------------------
def diarize_transcript(raw_transcript: str) -> dict:
    """
    Takes raw transcript text, returns diarized speaker turns via LLM.
    Handles long transcripts by chunking into ~3000-word segments and
    merging the resulting speaker turns.

    Returns:
        {
            "speaker_count": int,
            "turns": [{"speaker": "Speaker 1", "text": "..."}, ...]
        }
    """
    if not raw_transcript or len(raw_transcript.strip()) == 0:
        return {
            "speaker_count": 1,
            "turns": [{"speaker": "Speaker 1", "text": raw_transcript or ""}]
        }

    # Split into chunks of ~3000 words to avoid hitting token limits
    words = raw_transcript.split()
    chunk_size = 3000
    transcript_chunks = [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]

    all_turns = []
    all_speakers = set()

    for chunk in transcript_chunks:
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": DIARIZATION_SYSTEM_PROMPT},
                    {"role": "user", "content": chunk}
                ],
                temperature=0.0,        # deterministic — consistent parsing
                max_tokens=4000,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            # Validate expected keys exist
            if "turns" not in result or "speaker_count" not in result:
                # Fallback: wrap chunk as Speaker 1
                all_turns.append({"speaker": "Speaker 1", "text": chunk})
                all_speakers.add("Speaker 1")
            else:
                for turn in result["turns"]:
                    all_turns.append(turn)
                    all_speakers.add(turn.get("speaker", "Speaker 1"))
        except Exception as e:
            print(f"Error diarizing transcript chunk: {e}")
            # Safe fallback for this chunk
            all_turns.append({"speaker": "Speaker 1", "text": chunk})
            all_speakers.add("Speaker 1")

    return {
        "speaker_count": len(all_speakers),
        "turns": all_turns
    }


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