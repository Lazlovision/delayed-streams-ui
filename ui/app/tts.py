import os
import subprocess
import tempfile
import re
from pathlib import Path
from .config import Config

# Global variable to store the current running process
current_tts_process = None

def cancel_current_tts():
    global current_tts_process
    if current_tts_process is not None:
        try:
            current_tts_process.terminate()
            current_tts_process = None
            return True
        except Exception as e:
            return False
    return False

def get_available_voices():
    """
    Recursively search for all .safetensors files under the VOICE_FOLDER (default: all snapshots).
    The voice_name passed to the TTS backend is always in the form 'expresso/filename.wav' or 'vctk/filename.wav'.
    """
    root = Config.VOICE_FOLDER
    root_path = Path(root)
    if not root_path.exists():
        print(f"Voice folder root does not exist: {root_path}")
        return []
    safetensor_files = list(root_path.glob("**/*.safetensors"))
    if not safetensor_files:
        print(f"No .safetensors files found under {root_path}")
        return []
    voices = []
    for file_path in safetensor_files:
        filename = file_path.name
        try:
            # Find the path parts after the snapshot hash
            parts = file_path.parts
            try:
                idx = parts.index('snapshots')
                # voice_name = expresso/p343_023.wav
                voice_name = '/'.join(parts[idx+2:])  # skip 'snapshots' and the hash
            except ValueError:
                # fallback: use last two parts
                voice_name = '/'.join(parts[-2:])
            # Ensure voice_name ends at .wav (strip hash and .safetensors)
            if '.wav' in voice_name:
                voice_name = voice_name[:voice_name.index('.wav') + 4]
            # Remove .wav. and .safetensors hash from filename for display
            if '.wav.' in filename:
                base_name = filename.split('.wav.')[0] + '.wav'
            else:
                base_name = filename.replace('.safetensors', '')
                if '@' in base_name:
                    base_name = base_name.split('@')[0]
                if '.' in base_name and not base_name.endswith('.wav'):
                    base_name += '.wav'
            # For display, use the last two parts (e.g., expresso/p343_023.wav)
            display_name = '/'.join(voice_name.split('/')[-2:]).replace('_', ' ').replace('.wav', '').title()
            display_name = display_name.replace('Ex01 Ex02', 'Expresso')
            voices.append({
                'id': str(file_path),
                'name': display_name,
                'path': str(file_path),
                'voice_name': voice_name
            })
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            continue
    return sorted(voices, key=lambda x: x['name'])

def generate_tts_pytorch(text, voice_name, output_path):
    global current_tts_process
    # All configuration is now accessed via Config. No hardcoded paths or usernames remain.
    WSL_PROJECT_PATH = Config.WSL_PROJECT_PATH
    print(f"DEBUG: Using PyTorch backend")
    print(f"DEBUG: Text: {text[:50]}...")
    print(f"DEBUG: Voice: {voice_name}")
    print(f"DEBUG: Output: {output_path}")
    wsl_output_path = output_path.replace("\\", "/").replace("C:", "/mnt/c")
    with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.txt', encoding='utf-8') as text_file:
        text_file.write(text)
        text_file_path = text_file.name
    wsl_text_file_path = text_file_path.replace("\\", "/").replace("C:", "/mnt/c")
    voice_formats = [
        voice_name,
        voice_name.replace('expresso/', ''),
        os.path.basename(voice_name).replace('.wav', ''),
    ]
    for i, voice_format in enumerate(voice_formats):
        print(f"DEBUG: Trying PyTorch voice format {i+1}: {voice_format}")
        cmd = (
            f'wsl -d Ubuntu bash -c "cd {WSL_PROJECT_PATH} && '
            f'source tts-venv-wsl/bin/activate && '
            f'python3 {Config.TTS_PYTORCH_SCRIPT} {wsl_text_file_path} {wsl_output_path} --voice {voice_format}"'
        )
        print(f"DEBUG: Executing PyTorch command: {cmd}")
        try:
            current_tts_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stdout, stderr = current_tts_process.communicate(timeout=120)
            print(f"DEBUG: PyTorch command return code: {current_tts_process.returncode}")
            print(f"DEBUG: PyTorch command stdout: {stdout}")
            print(f"DEBUG: PyTorch command stderr: {stderr}")
            if current_tts_process.returncode == 0:
                print(f"DEBUG: PyTorch success with voice format: {voice_format}")
                current_tts_process = None
                return True, None
            else:
                print(f"DEBUG: PyTorch failed with voice format: {voice_format}")
                if i == len(voice_formats) - 1:
                    current_tts_process = None
                    return False, stderr if stderr else "PyTorch command failed"
        except subprocess.TimeoutExpired:
            if current_tts_process:
                current_tts_process.terminate()
                current_tts_process = None
            return False, "PyTorch TTS generation timed out"
        except Exception as e:
            if current_tts_process:
                current_tts_process.terminate()
                current_tts_process = None
            return False, f"PyTorch command execution failed: {str(e)}"
    try:
        os.remove(text_file_path)
    except Exception:
        pass
    current_tts_process = None
    return False, "All PyTorch voice formats failed"

def generate_tts_rust(text, voice_name, output_path):
    global current_tts_process
    # All configuration is now accessed via Config. No hardcoded paths or usernames remain.
    WSL_PROJECT_PATH = Config.WSL_PROJECT_PATH
    print(f"DEBUG: Using Rust server backend")
    print(f"DEBUG: Text: {text[:50]}...")
    print(f"DEBUG: Voice: {voice_name}")
    print(f"DEBUG: Output: {output_path}")
    wsl_output_path = output_path.replace("\\", "/").replace("C:", "/mnt/c")
    with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.txt', encoding='utf-8') as text_file:
        text_file.write(text)
        text_file_path = text_file.name
    wsl_text_file_path = text_file_path.replace("\\", "/").replace("C:", "/mnt/c")
    voice_formats = [
        voice_name,
        voice_name.replace('expresso/', ''),
        os.path.basename(voice_name).replace('.wav', ''),
    ]
    for i, voice_format in enumerate(voice_formats):
        print(f"DEBUG: Trying Rust voice format {i+1}: {voice_format}")
        cmd = (
            f'wsl -d Ubuntu bash -c "cd {WSL_PROJECT_PATH} && '
            f'source tts-venv-wsl/bin/activate && '
            f'python3 {Config.TTS_RUST_SCRIPT} --voice {voice_format} {wsl_text_file_path} {wsl_output_path}"'
        )
        print(f"DEBUG: Executing Rust command: {cmd}")
        try:
            current_tts_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stdout, stderr = current_tts_process.communicate(timeout=120)
            print(f"DEBUG: Rust command return code: {current_tts_process.returncode}")
            print(f"DEBUG: Rust command stdout: {stdout}")
            print(f"DEBUG: Rust command stderr: {stderr}")
            if current_tts_process.returncode == 0:
                print(f"DEBUG: Rust success with voice format: {voice_format}")
                current_tts_process = None
                return True, None
            else:
                print(f"DEBUG: Rust failed with voice format: {voice_format}")
                if i == len(voice_formats) - 1:
                    current_tts_process = None
                    return False, stderr if stderr else "Rust command failed"
        except subprocess.TimeoutExpired:
            if current_tts_process:
                current_tts_process.terminate()
                current_tts_process = None
            return False, "Rust TTS generation timed out"
        except Exception as e:
            if current_tts_process:
                current_tts_process.terminate()
                current_tts_process = None
            return False, f"Rust command execution failed: {str(e)}"
    try:
        os.remove(text_file_path)
    except Exception:
        pass
    current_tts_process = None
    return False, "All Rust voice formats failed"

# --- STT PyTorch helper ---
def run_stt_pytorch(audio_path, model='kyutai/stt-2.6b-en'):
    import subprocess
    import os
    # All configuration is now accessed via Config. No hardcoded paths or usernames remain.
    WSL_PROJECT_PATH = Config.WSL_PROJECT_PATH
    wsl_audio_path = audio_path.replace("\\", "/").replace("C:", "/mnt/c")
    cmd = (
        f'wsl -d Ubuntu bash -c "cd {WSL_PROJECT_PATH} && '
        f'source tts-venv-wsl/bin/activate && '
        f'python3 -m moshi.run_inference --hf-repo {model} {wsl_audio_path}"'
    )
    print(f"DEBUG: STT command: {cmd}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', timeout=120, shell=True)
        print(f"DEBUG: STT return code: {result.returncode}")
        print(f"DEBUG: STT stdout: {result.stdout}")
        print(f"DEBUG: STT stderr: {result.stderr}")
        if result.returncode != 0:
            return False, {"error": result.stderr.strip(), "debug": result.stdout.strip()}
        lines = result.stdout.strip().splitlines()
        transcript = lines[-1] if lines else ""
        debug_info = "\n".join(lines[:-1]) if len(lines) > 1 else ""
        return True, {"transcript": transcript, "debug": debug_info}
    except Exception as e:
        return False, {"error": str(e), "debug": ""}

# --- STT Rust Server helper ---
def run_stt_rust_server(audio_path, model='kyutai/stt-1b-en_fr', is_recorded=False):
    import subprocess
    import os
    import asyncio
    import tempfile
    import json
    # All configuration is now accessed via Config. No hardcoded paths or usernames remain.
    WSL_PROJECT_PATH = Config.WSL_PROJECT_PATH
    wsl_audio_path = audio_path.replace("\\", "/").replace("C:", "/mnt/c")
    
    # Choose the appropriate script based on whether it's recorded audio
    if is_recorded:
        # For recorded audio, use our new script that handles recorded audio properly
        cmd = (
            f'wsl -d Ubuntu bash -c "cd {WSL_PROJECT_PATH} && '
            f'source tts-venv-wsl/bin/activate && '
            f'python3 {Config.STT_FROM_RECORDED_AUDIO_SCRIPT} {wsl_audio_path} --url ws://127.0.0.1:8080 --api-key public_token --rtf 1000"'
        )
    else:
        # For uploaded files, use the file script
        cmd = (
            f'wsl -d Ubuntu bash -c "cd {WSL_PROJECT_PATH} && '
            f'source tts-venv-wsl/bin/activate && '
            f'python3 {Config.STT_FROM_FILE_RUST_SERVER_SCRIPT} {wsl_audio_path} --url ws://127.0.0.1:8080 --api-key public_token --rtf 1000"'
        )
    
    print(f"DEBUG: STT Rust command: {cmd}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', timeout=120, shell=True)
        print(f"DEBUG: STT Rust return code: {result.returncode}")
        print(f"DEBUG: STT Rust stdout: {result.stdout}")
        print(f"DEBUG: STT Rust stderr: {result.stderr}")
        if result.returncode != 0:
            return False, {"error": result.stderr.strip(), "debug": result.stdout.strip()}
        
        # Parse the output to extract transcript and timestamps
        lines = result.stdout.strip().splitlines()
        transcript_lines = []
        timestamp_lines = []
        
        for line in lines:
            if line.strip() and not line.startswith('DEBUG:') and not line.startswith('[Rust STT'):
                # Check if line contains timestamps (format: "1.36 - 1.76 The")
                if re.match(r'^\s*\d+\.\d+\s*-\s*\d+\.\d+\s+', line):
                    timestamp_lines.append(line.strip())
                else:
                    transcript_lines.append(line.strip())
        
        # Clean transcript (remove timestamps if present)
        clean_transcript = ' '.join(transcript_lines) if transcript_lines else ""
        
        # Format timestamps nicely if present
        formatted_timestamps = []
        for line in timestamp_lines:
            # Extract timestamp and word: "1.36 - 1.76 The" -> "The (1.36s-1.76s)"
            match = re.match(r'^\s*(\d+\.\d+)\s*-\s*(\d+\.\d+)\s+(.+)$', line)
            if match:
                start_time, end_time, word = match.groups()
                formatted_timestamps.append(f"{word} ({start_time}s-{end_time}s)")
        
        result_data = {
            "transcript": clean_transcript,
            "debug": result.stdout.strip(),
            "timestamps": formatted_timestamps
        }
        return True, result_data
    except Exception as e:
        return False, {"error": str(e), "debug": ""} 