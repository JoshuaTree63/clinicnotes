import os
import sys
import torch
import numpy as np

# Backward-compatible alias for old numpy usage
if not hasattr(np, 'NAN'):
    np.NAN = np.nan

# --- PyTorch 2.6 Compatibility Monkeypatch (MUST run BEFORE pyannote import) ---
# PyTorch 2.6 flipped the default of torch.load(weights_only=...) to True and
# pyannote's checkpoint contains globals (TorchVersion, etc.) that aren't on
# the default allowlist. The checkpoint is downloaded from HuggingFace under
# the user's auth token, so we trust it.
#
# Belt and suspenders:
#   1. Force weights_only=False on every torch.load — overrides even callers
#      that explicitly pass weights_only=True (some lightning internals do).
#   2. Allowlist TorchVersion as a safe global so strict mode also works.
#   3. Rewrite torch.load references in any already-imported module.

_original_torch_load = torch.load

def _patched_torch_load(*args, **kwargs):
    kwargs["weights_only"] = False  # force, not default
    return _original_torch_load(*args, **kwargs)

torch.load = _patched_torch_load

try:
    from torch.torch_version import TorchVersion
    torch.serialization.add_safe_globals([TorchVersion])
except Exception:
    pass

for _mod in list(sys.modules.values()):
    if _mod is None:
        continue
    if getattr(_mod, "load", None) is _original_torch_load:
        try:
            setattr(_mod, "load", _patched_torch_load)
        except Exception:
            pass
# -----------------------------------------------------------------------------

# --- HuggingFace Compatibility Monkeypatch (MUST run BEFORE pyannote import) ---
# pyannote-audio 3.x calls huggingface_hub.hf_hub_download(use_auth_token=...),
# but huggingface_hub >=0.32 removed that kwarg in favor of token=.
# We intercept and rename. This patch must be applied before `from pyannote.audio
# import Pipeline` — otherwise pyannote's submodules capture the unpatched
# reference at import time and the patch has no effect.
import huggingface_hub
import huggingface_hub.file_download

_original_hf_hub_download = huggingface_hub.hf_hub_download

def _patched_hf_hub_download(*args, **kwargs):
    if "use_auth_token" in kwargs:
        kwargs["token"] = kwargs.pop("use_auth_token")
    return _original_hf_hub_download(*args, **kwargs)

huggingface_hub.hf_hub_download = _patched_hf_hub_download
huggingface_hub.file_download.hf_hub_download = _patched_hf_hub_download

# Also rewrite any module that already captured a direct reference
# (e.g. `from huggingface_hub import hf_hub_download` inside pyannote).
for _mod in list(sys.modules.values()):
    if _mod is None:
        continue
    if getattr(_mod, "hf_hub_download", None) is _original_hf_hub_download:
        try:
            setattr(_mod, "hf_hub_download", _patched_hf_hub_download)
        except Exception:
            pass
# -----------------------------------------------------------------------------

import shutil
import subprocess
import tempfile

from pyannote.audio import Pipeline
from huggingface_hub import login


def _transcode_to_wav(src_path: str) -> str:
    """
    pyannote's loader (libsndfile) can't open M4A/AAC and some MP4 containers.
    Transcode anything we receive to 16 kHz mono WAV — pyannote's canonical input.
    Returns the path to a temp .wav the caller must delete.
    """
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found on PATH — required to transcode audio for pyannote.")

    fd, wav_path = tempfile.mkstemp(suffix=".wav", prefix="pyannote_")
    os.close(fd)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", src_path,
        "-ac", "1", "-ar", "16000",
        "-vn", "-f", "wav",
        wav_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        try:
            os.remove(wav_path)
        except OSError:
            pass
        raise RuntimeError(f"ffmpeg transcode failed: {result.stderr.strip()}")
    return wav_path


def run_diarization(file_path: str):
    """
    Run local acoustic diarization using pyannote.audio.
    Returns a list of segments with speaker labels: [{start, end, speaker}, ...]
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError("HF_TOKEN not set in .env — cannot run pyannote.")

    print(f"[pyannote] HF_TOKEN present ({len(hf_token)} chars). Logging in...")
    login(token=hf_token)

    print("[pyannote] Loading pipeline 'pyannote/speaker-diarization-3.1' (first run downloads ~500MB)...")
    try:
        # Newer huggingface_hub dropped `use_auth_token` in favor of `token`.
        # The login(token=...) call above already authenticates the session,
        # so we don't need to pass a token kwarg at all.
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
    except Exception as e:
        raise RuntimeError(
            f"Pipeline.from_pretrained failed: {e}. "
            "Common causes: (1) model license not accepted at "
            "https://hf.co/pyannote/speaker-diarization-3.1, "
            "(2) also need to accept https://hf.co/pyannote/segmentation-3.0, "
            "(3) HF_TOKEN lacks 'read' permission."
        ) from e

    if pipeline is None:
        raise RuntimeError(
            "Pipeline.from_pretrained returned None. This almost always means the "
            "model license hasn't been accepted for the HF account tied to HF_TOKEN. "
            "Accept BOTH: https://hf.co/pyannote/speaker-diarization-3.1 AND "
            "https://hf.co/pyannote/segmentation-3.0"
        )

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"[pyannote] Moving pipeline to device: {device}")
    pipeline.to(device)

    # Always transcode to 16kHz mono WAV — libsndfile can't open M4A/AAC and
    # some MP4 containers. WAV is pyannote's canonical input and is cheap.
    print(f"[pyannote] Transcoding {file_path} to WAV for pyannote...")
    wav_path = _transcode_to_wav(file_path)
    try:
        print(f"[pyannote] Running diarization on {wav_path}...")
        diarization = pipeline(wav_path)

        results = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            results.append({"start": turn.start, "end": turn.end, "speaker": speaker})

        unique_speakers = {r["speaker"] for r in results}
        print(f"[pyannote] Done. {len(unique_speakers)} speakers, {len(results)} segments.")
        return results
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass

def build_turns(aligned_segments: list[dict]) -> dict:
    """
    Collapse consecutive same-speaker aligned segments into turns and
    remap pyannote's raw labels (SPEAKER_00, SPEAKER_01, ...) to
    "Speaker 1", "Speaker 2", ... based on order of first appearance.

    Input:  [{start, end, speaker, text}, ...]
    Output: {"speaker_count": int, "turns": [{"speaker": "Speaker N", "text": "..."}]}
    """
    if not aligned_segments:
        return {"speaker_count": 0, "turns": []}

    # Rename by first-appearance order so Speaker 1 is whoever speaks first
    label_map: dict[str, str] = {}
    next_num = 1
    for seg in aligned_segments:
        raw = seg.get("speaker", "UNKNOWN")
        if raw not in label_map:
            label_map[raw] = f"Speaker {next_num}"
            next_num += 1

    # Merge consecutive segments with the same speaker into one turn.
    # Preserve timing: turn.start = first segment's start, turn.end = last segment's end.
    turns: list[dict] = []
    for seg in aligned_segments:
        speaker = label_map[seg.get("speaker", "UNKNOWN")]
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        start = seg.get("start")
        end = seg.get("end")
        if turns and turns[-1]["speaker"] == speaker:
            turns[-1]["text"] += " " + text
            if end is not None:
                turns[-1]["end"] = end
        else:
            turn = {"speaker": speaker, "text": text}
            if start is not None:
                turn["start"] = start
            if end is not None:
                turn["end"] = end
            turns.append(turn)

    return {"speaker_count": len(label_map), "turns": turns}


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
