import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


import tempfile
import subprocess
import glob
import re

def merge_consecutive_speakers(text: str) -> str:
    """
    Finds consecutive blocks from the same speaker and merges them into one.
    """
    lines = text.strip().split('\n')
    merged_lines = []
    current_speaker = None
    current_text = []

    for line in lines:
        if not line.strip():
            continue
            
        # Match "Speaker: Text" (handles Hebrew labels like מטפל: or מטופל:)
        match = re.match(r'^([^:]+):\s*(.*)$', line.strip())
        if match:
            speaker = match.group(1).strip()
            content = match.group(2).strip()
            
            if speaker == current_speaker:
                # Add a space if it doesn't end with a punctuation that suggests a split
                current_text.append(content)
            else:
                if current_speaker:
                    merged_lines.append(f"{current_speaker}: {' '.join(current_text)}")
                current_speaker = speaker
                current_text = [content]
        else:
            # If line doesn't follow the pattern, it might be a continuation of the previous speaker
            if current_speaker:
                current_text.append(line.strip())
            else:
                merged_lines.append(line.strip())

    if current_speaker:
        merged_lines.append(f"{current_speaker}: {' '.join(current_text)}")

    return '\n\n'.join(merged_lines)

from services.diarization_service import run_diarization, align_segments

def diarize_transcript(aligned_segments: list) -> str:
    """
    Uses a Groq LLM to rename acoustic Speaker IDs (SPEAKER_00, etc.) to 
    Therapist/Patient based on conversational context.
    """
    if not aligned_segments:
        return ""

    # Group by speaker locally first to keep the prompt smaller
    grouped_turns = []
    current_speaker = None
    current_text = []
    
    for seg in aligned_segments:
        if seg['speaker'] == current_speaker:
            current_text.append(seg['text'])
        else:
            if current_speaker:
                grouped_turns.append(f"{current_speaker}: {' '.join(current_text)}")
            current_speaker = seg['speaker']
            current_text = [seg['text']]
    
    if current_speaker:
        grouped_turns.append(f"{current_speaker}: {' '.join(current_text)}")

    formatted_input = "\n".join(grouped_turns)

    prompt = f"""
הטקסט הבא הוא תמליל של פגישת טיפול בעברית עם זיהוי דוברים אקוסטי (SPEAKER_00, SPEAKER_01 וכו').
אנא זהה מיהו המטפל ומיהו המטופל והחלף את התוויות SPEAKER_XX בשמות: "מטפל:" ו-"מטופל:".
השתמש בהקשר של השיחה (מי שואל שאלות, מי משתף וכו') כדי לקבוע את התפקידים.

חשוב: אל תשנה את הטקסט עצמו, רק את שמות הדוברים.

תמליל מקורי:
{formatted_input}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a professional clinical assistant. Map Speaker IDs to clinical roles (Therapist/Patient)."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
    )
    
    return response.choices[0].message.content

def transcribe_audio(file_path: str, language: str = None, progress_callback=None) -> str:
    """
    Lightning-fast Groq transcription MIXED with precise local acoustic diarization.
    1. Run local Pyannote diarization (accurate turns).
    2. Run Groq Whisper (fast text).
    3. Align and use LLM to rename speakers.
    """
    # 1. Run local acoustic diarization on the full file
    if progress_callback:
        progress_callback(0, 5) # Progress stage 0: Starting acoustic diarization
    
    print("Running local acoustic diarization...")
    acoustic_segments = run_diarization(file_path)
    
    if progress_callback:
        progress_callback(2, 5) # Progress stage 2: Diarization complete, starting Whisper

    # 2. Run Groq Whisper transcription (in chunks)
    full_whisper_segments = []
    
    ext = os.path.splitext(file_path)[1].lower() or ".mp3"
        
    with tempfile.TemporaryDirectory() as temp_dir:
        out_pattern = os.path.join(temp_dir, f"chunk_%03d{ext}")
        subprocess.run([
            "ffmpeg", "-nostdin", "-y", "-i", file_path, 
            "-f", "segment", "-segment_time", "600",
            "-c", "copy", out_pattern
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        chunk_files = sorted(glob.glob(os.path.join(temp_dir, f"chunk_*{ext}")))
        
        # Calculate offset for segments in later chunks
        time_offset = 0.0
        
        for i, chunk_file in enumerate(chunk_files):
            with open(chunk_file, "rb") as f:
                params = {"model": "whisper-large-v3", "file": f, "response_format": "verbose_json"}
                if language: params["language"] = language
                    
                resp = client.audio.transcriptions.create(**params)
                segments = getattr(resp, 'segments', [])
                
                # Update timestamps with chunk offset
                for seg in segments:
                    seg['start'] += time_offset
                    seg['end'] += time_offset
                    full_whisper_segments.append(seg)
                
                # Update offset for next chunk
                if segments:
                    time_offset = full_whisper_segments[-1]['end']
                else:
                    time_offset += 600.0 # fallback

            if progress_callback:
                progress_callback(3 + (i / len(chunk_files)), 5)

    # 3. Align Whisper text with Acoustic Speakers
    aligned_segments = align_segments(full_whisper_segments, acoustic_segments)

    # 4. Use AI to rename SPEAKER_XX to Therapist/Patient
    final_output = diarize_transcript(aligned_segments)
    
    if progress_callback:
        progress_callback(5, 5)

    return final_output
