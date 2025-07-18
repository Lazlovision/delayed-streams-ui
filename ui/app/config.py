import os
from pathlib import Path

def get_wsl_project_path():
    wsl_env = os.getenv("WSL_PROJECT_PATH")
    if wsl_env:
        return wsl_env
    
    # Get the project root (one level up from the app directory)
    app_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(app_dir))  # Go up two levels: app/ -> ui/ -> project_root
    
    if os.name == "nt" and len(project_root) > 2 and project_root[1] == ":":
        drive = project_root[0].lower()
        path = project_root[2:].replace("\\", "/")
        return f"/mnt/{drive}{path}"
    return project_root

class Config:
    # Voice folder: can be set via VOICE_FOLDER env var, else auto-detect HuggingFace cache
    VOICE_FOLDER = os.getenv(
        "VOICE_FOLDER",
        str(Path.home() / ".cache/huggingface/hub/models--kyutai--tts-voices/snapshots")
    )

    # TTS scripts (relative paths)
    TTS_RUST_SCRIPT = os.getenv("TTS_RUST_SCRIPT", "backend/scripts/tts_rust_server.py")
    TTS_PYTORCH_SCRIPT = os.getenv("TTS_PYTORCH_SCRIPT", "backend/scripts/tts_pytorch.py")

    # STT scripts
    STT_FROM_FILE_RUST_SERVER_SCRIPT = os.getenv("STT_FROM_FILE_RUST_SERVER_SCRIPT", "backend/scripts/stt_from_file_rust_server.py")
    STT_FROM_RECORDED_AUDIO_SCRIPT = os.getenv("STT_FROM_RECORDED_AUDIO_SCRIPT", "backend/scripts/stt_from_file_rust_server.py")

    # Project root for WSL: can be set via WSL_PROJECT_PATH env var, else try to auto-detect
    WSL_PROJECT_PATH = get_wsl_project_path()
    
    # Configurable settings
    WSL_DISTRIBUTION = os.getenv("WSL_DISTRIBUTION", "Ubuntu")
    TTS_SERVER_PORT = os.getenv("TTS_SERVER_PORT", "8080")
    STT_SERVER_PORT = os.getenv("STT_SERVER_PORT", "8080")
    UI_SERVER_PORT = os.getenv("UI_SERVER_PORT", "5000")
    DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true" 