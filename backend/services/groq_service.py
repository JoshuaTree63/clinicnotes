import os
from groq import Groq

# Initialize Groq client with API key from environment variables
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def transcribe_audio(file_path: str, language: str = "en") -> str:
    """
    Sends an audio file to Groq's Whisper API for transcription and returns the text.
    """
    with open(file_path, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            model="whisper-large-v3", # Specify the Whisper model
            file=audio_file,
            language=language,
            response_format="text" # Request plain text output
        )
    return str(transcription).strip() if transcription else ""