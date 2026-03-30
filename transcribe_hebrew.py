from pathlib import Path

class AppConfig:
    """Configuration for the audio upload and transcription service."""
    def __init__(self):
        # Directory where uploaded audio files will be stored
        self.audio_dir = Path("data/audio_input")
        # Audio formats supported by Groq/Whisper
        self.supported_ext = [
            ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"
        ]