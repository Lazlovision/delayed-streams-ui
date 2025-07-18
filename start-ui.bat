@echo off 
echo Starting Delayed Streams UI... 
call tts-venv-windows\Scripts\activate 
cd ui 
set UI_SERVER_PORT=5000 
set DEBUG_MODE=false 
python run.py 
pause 
