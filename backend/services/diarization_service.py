import os
import torch
from pyannote.audio import Pipeline
from huggingface_hub import login, hf_hub_download
import huggingface_hub

# --- HuggingFace Compatibility Monkeypatch ---
# pyannote-audio uses 'use_auth_token' which is deprecated in newer hf_hub
# We intercept the call and rename the argument to 'token'
_original_hf_hub_download = huggingface_hub.hf_hub_download

def _patched_hf_hub_download(*args, **kwargs):
    if "use_auth_token" in kwargs:
        kwargs["token"] = kwargs.pop("use_auth_token")
    return _original_hf_hub_download(*args, **kwargs)

huggingface_hub.hf_hub_download = _patched_hf_hub_download
# ---------------------------------------------

def run_diarization(file_path: str):
    """
    Run local acoustic diarization using pyannote.audio.
    Returns a list of segments with speaker labels: [{start, end, speaker}, ...]
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise Exception("HF_TOKEN not found in environment variables. Required for Pyannote.")

    # Login globally to bypass argument conflicts in different library versions
    login(token=hf_token)

    # Initialize the pipeline
    # Note: Use pyannote/speaker-diarization-3.1 which is the standard
    pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")

    # Move to GPU/MPS if available
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    pipeline.to(device)

    # Run the pipeline
    diarization = pipeline(file_path)

    # Parse results
    results = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        results.append({
            "start": turn.start,
            "end": turn.end,
            "speaker": speaker
        })
        
    return results

def align_segments(whisper_segments, diarization_segments):
    """
    Align Whisper text segments with Pyannote speaker labels.
    Assigns the most frequent speaker in the time range to each segment.
    """
    aligned_transcript = []
    
    for w_seg in whisper_segments:
        w_start = w_seg['start']
        w_end = w_seg['end']
        w_text = w_seg['text']
        
        # Find overlaps
        overlaps = {}
        for d_seg in diarization_segments:
            # Calculate overlap duration
            overlap_start = max(w_start, d_seg['start'])
            overlap_end = min(w_end, d_seg['end'])
            
            if overlap_start < overlap_end:
                duration = overlap_end - overlap_start
                speaker = d_seg['speaker']
                overlaps[speaker] = overlaps.get(speaker, 0) + duration
        
        # Assign speaker with most overlap
        if overlaps:
            best_speaker = max(overlaps, key=overlaps.get)
        else:
            best_speaker = "UNKNOWN"
            
        aligned_transcript.append({
            "start": w_start,
            "end": w_end,
            "speaker": best_speaker,
            "text": w_text
        })
        
    return aligned_transcript
