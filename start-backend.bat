@echo off 
echo Starting WSL backend... 
wsl bash -c "cd '/mnt/c/delayed-streams-ui' && source tts-venv-wsl/bin/activate && python backend_server.py" 
pause 
