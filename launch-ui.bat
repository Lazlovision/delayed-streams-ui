@echo off
cd /d "%~dp0"
call tts-venv-windows\Scripts\activate.bat
python ui\run.py