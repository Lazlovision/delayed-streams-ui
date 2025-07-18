from flask import request, jsonify, send_file, render_template
from .tts import get_available_voices, generate_tts_pytorch, generate_tts_rust, run_stt_pytorch, run_stt_rust_server
import os
import tempfile
import subprocess
import threading
import time
import socket
import re
import queue
import collections
from .config import Config

# WSL availability check
def check_wsl_availability():
    """Check if WSL is available and working"""
    try:
        result = subprocess.run(['wsl', '--version'], capture_output=True, text=True, timeout=10)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False

# Rust TTS server process and status tracking
TTS_LOG_FILE = 'tts_server.log'
tts_server_process = None
tts_server_status = 'offline'  # 'offline', 'starting', 'online'
tts_server_lock = threading.Lock()
tts_server_last_error = ''
tts_server_last_url = ''

# Rust STT server process and status tracking
stt_server_process = None
stt_server_status = 'offline'  # 'offline', 'starting', 'online'
stt_server_last_output = ''
stt_server_lock = threading.Lock()
stt_server_last_error = ''
stt_server_last_url = ''
stt_server_config = ''  # Current config file being used

def init_app(app):
    @app.route('/api/voices', methods=['GET'])
    def get_voices():
        try:
            voices = get_available_voices()
            return jsonify({'voices': voices})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/text-to-speech', methods=['POST'])
    def text_to_speech():
        try:
            data = request.get_json()
            text = data.get('text', '').strip()
            voice_id = data.get('voice', '')
            backend = data.get('backend', 'pytorch')
            if not text:
                return jsonify({'error': 'Text is required'}), 400
            if not voice_id:
                return jsonify({'error': 'Voice selection is required'}), 400
            if backend not in ['pytorch', 'rust']:
                return jsonify({'error': 'Invalid backend specified'}), 400
            voices = get_available_voices()
            voice_path = None
            voice_name = None
            for voice in voices:
                if voice['id'] == voice_id:
                    voice_path = voice['path']
                    voice_name = voice.get('voice_name', voice['id'])
                    break
            if not voice_path:
                return jsonify({'error': 'Voice not found'}), 404
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                output_path = tmp_file.name
            try:
                if backend == 'pytorch':
                    success, error = generate_tts_pytorch(text, voice_name, output_path)
                else:
                    success, error = generate_tts_rust(text, voice_name, output_path)
                if not success:
                    return jsonify({'error': f'TTS generation failed ({backend} backend): {error}'}), 500
                if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                    return jsonify({'error': f'No audio output generated ({backend} backend)'}), 500
                return send_file(
                    output_path,
                    mimetype='audio/wav',
                    as_attachment=True,
                    download_name=f'output_{backend}.wav'
                )
            except Exception as e:
                return jsonify({'error': f'Backend execution failed ({backend}): {str(e)}'}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'healthy'})

    @app.route('/api/backends', methods=['GET'])
    def get_backends():
        backends = {
            'pytorch': {
                'name': 'PyTorch',
                'description': 'Direct PyTorch implementation, no server required',
                'pros': ['Faster startup', 'More reliable', 'No separate server needed'],
                'cons': ['May use more memory during generation']
            },
            'rust': {
                'name': 'Rust Server',
                'description': 'Uses the Rust server implementation',
                'pros': ['May be faster for batch processing', 'Lower memory usage'],
                'cons': ['Requires separate server process', 'More complex setup']
            }
        }
        return jsonify({'backends': backends})

    @app.route('/api/cancel', methods=['POST'])
    def cancel_generation():
        from .tts import cancel_current_tts
        success = cancel_current_tts()
        if success:
            return jsonify({'status': 'cancelled'})
        else:
            return jsonify({'status': 'no_process'}), 400

    @app.route('/api/open-folder', methods=['POST'])
    def open_folder():
        data = request.get_json()
        file_path = data.get('path')
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'Invalid file path'}), 400
        try:
            subprocess.Popen(['explorer.exe', '/select,', os.path.normpath(file_path)])
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/speech-to-text', methods=['POST'])
    def speech_to_text():
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        audio_file = request.files['audio']
        model = request.form.get('model', 'kyutai/stt-2.6b-en')
        backend = request.form.get('backend', 'pytorch')
        
        if backend not in ['pytorch', 'rust']:
            return jsonify({'error': 'Invalid backend specified'}), 400
            
        # Save the uploaded file first
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name
            
        # Convert to proper format using ffmpeg in WSL
        wsl_input_path = tmp_path.replace("\\", "/").replace("C:", "/mnt/c")
        converted_path = tmp_path.replace('.wav', '_converted.wav')
        wsl_converted_path = converted_path.replace("\\", "/").replace("C:", "/mnt/c")
        
        # Check if this is recorded audio and convert accordingly
        is_recorded = 'recorded_audio.wav' in audio_file.filename if audio_file.filename else False
        
        if is_recorded:
            # For recorded audio, convert to 24kHz mono WAV (what the Rust server expects)
            # Use WAV format with PCM float32 that sphn can read
            # Try different formats that sphn might support
            convert_cmd = f'wsl -d Ubuntu bash -c "ffmpeg -i {wsl_input_path} -ar 24000 -ac 1 -c:a pcm_s16le -f wav {wsl_converted_path} -y"'
        else:
            # For uploaded files, convert to 16kHz mono (what PyTorch expects)
            convert_cmd = f'wsl -d Ubuntu bash -c "ffmpeg -i {wsl_input_path} -ar 16000 -ac 1 -c:a pcm_s16le {wsl_converted_path} -y"'
        
        try:
            subprocess.run(convert_cmd, shell=True, check=True, capture_output=True, text=True, encoding='utf-8', timeout=30)
            # Use the converted file for STT processing
            stt_input_path = converted_path
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            # If ffmpeg fails or times out, try using the original file
            print(f"Audio conversion failed: {e}")
            stt_input_path = tmp_path
            
        try:
            if backend == 'pytorch':
                success, result = run_stt_pytorch(stt_input_path, model)
            else:
                # Use Rust STT server
                # Check if this is recorded audio (from the file name)
                is_recorded = 'recorded_audio.wav' in audio_file.filename if audio_file.filename else False
                success, result = run_stt_rust_server(stt_input_path, model, is_recorded)
                
            if not success:
                return jsonify(result), 500
            return jsonify(result)
        finally:
            # Clean up both files
            try:
                os.remove(tmp_path)
                if stt_input_path != tmp_path:
                    os.remove(stt_input_path)
            except:
                pass

    @app.route('/')
    def index():
        return render_template('index.html')

    # Rust TTS server process and status tracking
    global tts_server_process, tts_server_status, tts_server_last_output, tts_server_lock, tts_server_last_error, tts_server_last_url

    def start_rust_tts_server():
        global tts_server_process, tts_server_status, tts_server_last_error, tts_server_last_url
        
        # Check WSL availability first
        if not check_wsl_availability():
            tts_server_last_error = "WSL is not available. Please ensure WSL is installed and running."
            return 'wsl_unavailable'
            
        with tts_server_lock:
            if tts_server_process and tts_server_process.poll() is None:
                return 'already_running'
            tts_server_status = 'starting'
            tts_server_last_error = ''
            tts_server_last_url = ''
            def run_server():
                global tts_server_process, tts_server_status, tts_server_last_error, tts_server_last_url
                # Clear the log file
                try:
                    with open(TTS_LOG_FILE, 'w') as f:
                        pass
                except Exception:
                    pass
                cmd = (
                    f'wsl -d {Config.WSL_DISTRIBUTION} bash -c "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/.cargo/bin; cd {Config.WSL_PROJECT_PATH}/backend && source ../tts-venv-wsl/bin/activate && moshi-server worker --config configs/config-tts.toml"'
                )
                launch_msg = f"[Rust TTS Server] Launching: {cmd}"
                print(launch_msg)
                try:
                    with open(TTS_LOG_FILE, 'a') as f:
                        f.write(launch_msg + '\n')
                except Exception:
                    pass
                tts_server_process = subprocess.Popen(
                    cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                try:
                    if tts_server_process.stdout:
                        for line in tts_server_process.stdout:
                            log_line = line.rstrip('\n')
                            print(f"[Rust TTS Server] {log_line}")
                            try:
                                with open(TTS_LOG_FILE, 'a') as f:
                                    f.write(f"[Rust TTS Server] {log_line}\n")
                            except Exception:
                                pass
                            if 'listening on http://' in line:
                                tts_server_status = 'online'
                                print(f"[DEBUG] TTS Server status set to: {tts_server_status}")
                                # Extract URL
                                m = re.search(r'listening on (http://[\w\.:]+)', line)
                                if m:
                                    tts_server_last_url = m.group(1)
                                    print(f"[DEBUG] TTS Server URL extracted: {tts_server_last_url}")
                                # Exit the loop immediately after finding the listening message
                                print(f"[DEBUG] Breaking from stdout loop, server is online")
                                break
                    print(f"[DEBUG] After stdout loop, status: {tts_server_status}")
                    # Check if process failed ONLY if we never got the \"listening\" message
                    if tts_server_status != 'online':
                        exit_code = tts_server_process.poll()
                        print(f"[DEBUG] Process not online, exit code: {exit_code}")
                        if exit_code is not None and exit_code != 0:
                            # Process has ended with an error code
                            tts_server_last_error = f"Process exited with error code: {exit_code}"
                            print(f"[Rust TTS Server ERROR] Process exited early: {tts_server_last_error}")
                            tts_server_status = 'offline'
                    else:
                        print(f"[DEBUG] Server is online, keeping status as online")
                except Exception as e:
                    tts_server_last_error = str(e)
                    print(f"[Rust TTS Server ERROR] {e}")
                    tts_server_status = 'offline'
            threading.Thread(target=run_server, daemon=True).start()
        return 'starting'

    def stop_rust_tts_server():
        global tts_server_process, tts_server_status
        with tts_server_lock:
            if tts_server_process and tts_server_process.poll() is None:
                try:
                    # Try graceful termination first
                    tts_server_process.terminate()
                    # Wait a bit for graceful shutdown
                    import time
                    time.sleep(2)
                    # If still running, force kill
                    if tts_server_process.poll() is None:
                        tts_server_process.kill()
                        time.sleep(1)
                except Exception as e:
                    print(f"[Rust TTS Server] Error stopping server: {e}")
                tts_server_status = 'offline'
                return 'stopping'
            tts_server_status = 'offline'
            return 'not_running'

    def get_rust_tts_server_status():
        global tts_server_process, tts_server_status, tts_server_last_error, tts_server_last_url
        with tts_server_lock:
            print(f"[DEBUG] get_rust_tts_server_status called")
            print(f"[DEBUG] tts_server_process: {tts_server_process}")
            print(f"[DEBUG] tts_server_status: {tts_server_status}")
            print(f"[DEBUG] tts_server_last_url: {tts_server_last_url}")
            if tts_server_process:
                poll_result = tts_server_process.poll()
                print(f"[DEBUG] Process poll result: {poll_result}")
                if poll_result is None:
                    print(f"[DEBUG] Process is still running, returning status: {tts_server_status}")
                    return tts_server_status, tts_server_last_url
            if tts_server_last_url:
                print(f"[DEBUG] Trying to connect to URL: {tts_server_last_url}")
                # Try to connect to the port
                m = re.search(r'http://([\w\.]+):(\d+)', tts_server_last_url)
                if m:
                    host, port = m.group(1), int(m.group(2))
                    # Patch: if host is 0.0.0.0, use 127.0.0.1 for connection
                    if host == '0.0.0.0':
                        host = '127.0.0.1'
                    print(f"[DEBUG] Connecting to {host}:{port}")
                    try:
                        with socket.create_connection((host, port), timeout=1):
                            print(f"[DEBUG] Connection successful, server is online")
                            return 'online', tts_server_last_url
                    except Exception as e:
                        print(f"[DEBUG] Connection failed: {e}")
                        pass
            if tts_server_last_error:
                print(f"[DEBUG] Returning error status")
                return 'error', ''
            print(f"[DEBUG] Returning offline status")
            return 'offline', ''

    @app.route('/api/start-rust-tts-server', methods=['POST'])
    def api_start_rust_tts_server():
        status = start_rust_tts_server()
        return jsonify({'status': status})

    @app.route('/api/stop-rust-tts-server', methods=['POST'])
    def api_stop_rust_tts_server():
        status = stop_rust_tts_server()
        # Also try to kill any processes using port 8080 (TTS server port)
        try:
            subprocess.run('wsl -d Ubuntu bash -c "pkill -f moshi-server"', shell=True, capture_output=True, encoding='utf-8')
        except Exception as e:
            print(f"[Rust TTS Server] Error killing processes: {e}")
        return jsonify({'status': status})

    @app.route('/api/rust-tts-server-status', methods=['GET'])
    def api_rust_tts_server_status():
        status, url = get_rust_tts_server_status()
        return jsonify({'status': status, 'url': url})

    @app.route('/api/rust-tts-server-error', methods=['GET'])
    def api_rust_tts_server_error():
        global tts_server_last_error
        return jsonify({'error': tts_server_last_error})

    @app.route('/api/rust-tts-server-log', methods=['GET'])
    def api_rust_tts_server_log():
        # Return the last 20 log lines containing '[Rust TTS Server]' (case-insensitive) from the log file
        logs = []
        if os.path.exists(TTS_LOG_FILE):
            try:
                with open(TTS_LOG_FILE, 'r') as f:
                    lines = f.readlines()
                    filtered = [line.strip() for line in lines if '[rust tts server' in line.lower()]
                    logs = filtered[-20:]
            except Exception:
                pass
        return jsonify({'log': logs})

    # Rust STT server process and status tracking
    global stt_server_process, stt_server_status, stt_server_last_output, stt_server_lock, stt_server_last_error, stt_server_last_url, stt_server_config

    def start_rust_stt_server(model='kyutai/stt-1b-en_fr'):
        global stt_server_process, stt_server_status, stt_server_last_output, stt_server_last_error, stt_server_last_url, stt_server_config
        
        # Check WSL availability first
        if not check_wsl_availability():
            stt_server_last_error = "WSL is not available. Please ensure WSL is installed and running."
            return 'wsl_unavailable'
            
        with stt_server_lock:
            if stt_server_process and stt_server_process.poll() is None:
                return 'already_running'
            
            # Determine config file based on model
            if model == 'kyutai/stt-1b-en_fr':
                config_file = 'configs/config-stt-en_fr-hf.toml'
            elif model == 'kyutai/stt-2.6b-en':
                config_file = 'configs/config-stt-en-hf.toml'
            else:
                return 'invalid_model'
            
            stt_server_status = 'starting'
            stt_server_last_output = ''
            stt_server_last_error = ''
            stt_server_last_url = ''
            stt_server_config = config_file
            
            def run_server():
                global stt_server_process, stt_server_status, stt_server_last_output, stt_server_last_error, stt_server_last_url
                cmd = (
                    f'wsl -d {Config.WSL_DISTRIBUTION} bash -c "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/.cargo/bin; cd {Config.WSL_PROJECT_PATH}/backend && source ../tts-venv-wsl/bin/activate && moshi-server worker --config ' + config_file + '"'
                )
                print(f"[Rust STT Server] Launching: {cmd}")
                stt_server_process = subprocess.Popen(
                    cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                try:
                    if stt_server_process.stdout:
                        for line in stt_server_process.stdout:
                            print(f"[Rust STT Server] {line.strip()}")
                            stt_server_last_output += line
                            if 'listening on http://' in line:
                                stt_server_status = 'online'
                                # Extract URL
                                m = re.search(r'listening on (http://[\w\.:]+)', line)
                                if m:
                                    stt_server_last_url = m.group(1)
                    stt_server_status = 'offline'
                except Exception as e:
                    stt_server_last_error = str(e)
                    print(f"[Rust STT Server ERROR] {e}")
                    stt_server_status = 'offline'
                if stt_server_process.poll() not in (None, 0):
                    stt_server_last_error = stt_server_process.stdout.read() if stt_server_process.stdout else 'Unknown error'
                    print(f"[Rust STT Server ERROR] Process exited early: {stt_server_last_error}")
            threading.Thread(target=run_server, daemon=True).start()
        return 'starting'

    def stop_rust_stt_server():
        global stt_server_process, stt_server_status
        with stt_server_lock:
            if stt_server_process and stt_server_process.poll() is None:
                try:
                    # Try graceful termination first
                    stt_server_process.terminate()
                    # Wait a bit for graceful shutdown
                    import time
                    time.sleep(2)
                    # If still running, force kill
                    if stt_server_process.poll() is None:
                        stt_server_process.kill()
                        time.sleep(1)
                except Exception as e:
                    print(f"[Rust STT Server] Error stopping server: {e}")
                stt_server_status = 'offline'
                return 'stopping'
            stt_server_status = 'offline'
            return 'not_running'

    def get_rust_stt_server_status():
        global stt_server_process, stt_server_status, stt_server_last_error, stt_server_last_url
        with stt_server_lock:
            if stt_server_process and stt_server_process.poll() is None:
                return stt_server_status, stt_server_last_url
            if stt_server_last_url:
                # Try to connect to the port
                m = re.search(r'http://([\w\.]+):(\d+)', stt_server_last_url)
                if m:
                    host, port = m.group(1), int(m.group(2))
                    try:
                        with socket.create_connection((host, port), timeout=1):
                            return 'online', stt_server_last_url
                    except Exception:
                        pass
            if stt_server_last_error:
                return 'error', ''
            return 'offline', ''

    @app.route('/api/start-rust-stt-server', methods=['POST'])
    def api_start_rust_stt_server():
        data = request.get_json()
        model = data.get('model', 'kyutai/stt-1b-en_fr')
        status = start_rust_stt_server(model)
        return jsonify({'status': status})

    @app.route('/api/stop-rust-stt-server', methods=['POST'])
    def api_stop_rust_stt_server():
        status = stop_rust_stt_server()
        # Also try to kill any processes using port 8080 (STT server port)
        try:
            subprocess.run('wsl -d Ubuntu bash -c "pkill -f moshi-server"', shell=True, capture_output=True, encoding='utf-8')
        except Exception as e:
            print(f"[Rust STT Server] Error killing processes: {e}")
        return jsonify({'status': status})

    @app.route('/api/rust-stt-server-status', methods=['GET'])
    def api_rust_stt_server_status():
        status, url = get_rust_stt_server_status()
        return jsonify({'status': status, 'url': url})

    @app.route('/api/rust-stt-server-error', methods=['GET'])
    def api_rust_stt_server_error():
        global stt_server_last_error
        return jsonify({'error': stt_server_last_error})

    @app.route('/api/rust-stt-server-log', methods=['GET'])
    def api_rust_stt_server_log():
        global stt_server_last_output
        keywords = [
            'retrieving', 'loading', 'fetching', 'starting-up', 'listening', 'handling', 'ready to roll'
        ]
        lines = stt_server_last_output.splitlines()
        filtered = [line for line in lines if any(k in line.lower() for k in keywords)]
        return jsonify({'log': filtered[-10:]}) 