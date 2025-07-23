@echo off
setlocal enabledelayedexpansion

REM ================================
REM Delayed Streams UI Setup Script
REM ================================

REM === Configuration Variables ===
set "PYTHON_VERSION=3.12.7"
set "PYTHON_MIN_MAJOR=3"
set "PYTHON_MIN_MINOR=10"
set "WINDOWS_VENV=tts-venv-windows"
set "WSL_VENV=tts-venv-wsl"
REM Set your CUDA version here (cu121 for CUDA 12.1, cu118 for CUDA 11.8, etc.)
set "PYTORCH_CUDA_VERSION=cu121"

REM === Helper Functions ===
goto :main

:check_command
    %~1 --version >nul 2>&1
    if %errorlevel% equ 0 (
        set "result=true"
    ) else (
        set "result=false"
    )
goto :eof

:install_python
    echo Installing Python %PYTHON_VERSION%...
    curl -L -o python-installer.exe https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-amd64.exe
    if %errorlevel% neq 0 (
        echo ERROR: Failed to download Python installer
        set "install_result=false"
        goto :eof
    )
    
    python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
    del python-installer.exe
    
    REM Test installation
    python --version >nul 2>&1
    if %errorlevel% equ 0 (
        set "install_result=true"
    ) else (
        set "install_result=false"
    )
goto :eof

:check_python_version
    echo Checking Python version...
    for /f "tokens=2" %%a in ('python --version 2^>^&1') do (
        set "full_version=%%a"
    )
    
    REM Extract major and minor version numbers
    for /f "tokens=1,2 delims=." %%b in ("!full_version!") do (
        set "py_major=%%b"
        set "py_minor=%%c"
    )
    
    echo Found Python !py_major!.!py_minor!
    
    REM Check if version is adequate (3.10+)
    if !py_major! gtr %PYTHON_MIN_MAJOR% (
        set "version_ok=true"
    ) else if !py_major! equ %PYTHON_MIN_MAJOR% (
        if !py_minor! geq %PYTHON_MIN_MINOR% (
            set "version_ok=true"
        ) else (
            set "version_ok=false"
        )
    ) else (
        set "version_ok=false"
    )
    
    if "!version_ok!"=="false" (
        echo ERROR: Python !py_major!.!py_minor! is too old - need %PYTHON_MIN_MAJOR%.%PYTHON_MIN_MINOR%+
    )
goto :eof

:setup_wsl
    echo Checking WSL installation...
    wsl --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo Installing WSL...
        wsl --install --distribution Ubuntu
        if !errorlevel! neq 0 (
            echo ERROR: WSL installation failed
            set "wsl_result=false"
            goto :eof
        )
        echo WSL installed. Please restart your computer and run this script again.
        set "wsl_result=restart"
        goto :eof
    )
    
    REM Test WSL functionality - give it time to initialize
    echo Testing WSL functionality...
    timeout /t 2 >nul
    wsl echo "test" >nul 2>&1
    if !errorlevel! neq 0 (
        echo WSL appears to be installed but not fully initialized.
        echo This often happens after a fresh WSL installation.
        echo.
        echo Please try one of the following:
        echo   1. Restart your computer and run this script again
        echo   2. Or run 'wsl --shutdown' then 'wsl' in a new command prompt
        echo   3. Then run this script again
        echo.
        set "wsl_result=restart"
        goto :eof
    )
    
    set "wsl_result=true"
goto :eof

:convert_to_wsl_path
    for /f "delims=" %%i in ('wsl wslpath "%~1"') do set "wsl_path=%%i"
goto :eof

:clone_kyutai_backend
    echo Cloning Kyutai backend repository...
    if exist "delayed-streams-modeling" (
        echo Kyutai backend already exists, updating...
        cd delayed-streams-modeling
        git pull origin main
        if !errorlevel! neq 0 (
            echo WARNING: Failed to update Kyutai repository, continuing with existing version
        ) else (
            echo Kyutai backend updated successfully
        )
        cd ..
    ) else (
        echo Downloading Kyutai backend...
        git clone https://github.com/kyutai-labs/delayed-streams-modeling.git
        if !errorlevel! neq 0 (
            echo ERROR: Failed to clone Kyutai repository
            set "clone_result=false"
            goto :eof
        )
        echo Kyutai backend cloned successfully
    )
    set "clone_result=true"
goto :eof

:main
REM === Step 1: Check Prerequisites ===
echo [1/9] Checking prerequisites...

REM Check Git
echo Checking Git installation...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed or not in PATH
    echo.
    echo Please install Git from https://git-scm.com/downloads
    echo Make sure to:
    echo   1. Check "Add Git to PATH" during installation
    echo   2. Restart this command prompt after installation
    echo   3. Run this script again
    echo.
    pause
    exit /b 1
)
echo Git: OK

REM Check Python
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found, installing...
    call :install_python
    if "!install_result!"=="false" (
        echo ERROR: Python installation failed
        pause
        exit /b 1
    )
    echo Python installed successfully
) else (
    call :check_python_version
    if "!version_ok!"=="false" (
        echo Python version check failed
        pause
        exit /b 1
    )
    echo Python: OK
)

REM Check project structure
if not exist "ui\run.py" (
    echo ERROR: ui\run.py not found
    echo Please run this script from the delayed-streams-ui directory
    pause
    exit /b 1
)
echo Project structure: OK

REM === Step 2: Clone Kyutai Backend ===
echo [2/9] Setting up Kyutai backend...
call :clone_kyutai_backend
if "!clone_result!"=="false" (
    echo Kyutai backend setup failed
    pause
    exit /b 1
)
echo Kyutai backend: OK

REM === Step 3: WSL Setup ===
echo [3/9] Setting up WSL...
call :setup_wsl
if "!wsl_result!"=="false" (
    echo WSL setup failed
    pause
    exit /b 1
) else if "!wsl_result!"=="restart" (
    pause
    exit /b 0
)
echo WSL: OK

REM === Step 4: Path Conversion ===
echo [4/9] Converting paths for WSL...
call :convert_to_wsl_path "%CD%"
echo Windows path: %CD%
echo WSL path: !wsl_path!

REM Test WSL path access
wsl test -d "!wsl_path!" >nul 2>&1
if !errorlevel! neq 0 (
    echo ERROR: WSL cannot access project directory
    pause
    exit /b 1
)
echo Path conversion: OK

REM === Step 5: Windows Environment ===
echo [5/9] Setting up Windows environment...
if exist %WINDOWS_VENV% (
    echo Windows environment exists, updating...
    call %WINDOWS_VENV%\Scripts\activate
    python -m pip install --upgrade pip >nul 2>&1
) else (
    echo Creating Windows environment...
    python -m venv %WINDOWS_VENV%
    if !errorlevel! neq 0 (
        echo ERROR: Failed to create Windows environment
        pause
        exit /b 1
    )
    call %WINDOWS_VENV%\Scripts\activate
    python -m pip install --upgrade pip setuptools wheel
)

echo Installing Windows UI dependencies...
pip install flask flask-cors flask-socketio requests psutil numpy websockets msgpack
if !errorlevel! neq 0 (
    echo ERROR: Failed to install UI dependencies
    pause
    exit /b 1
)
echo Windows environment: OK

REM === Step 6: WSL System Packages ===
echo [6/9] Installing WSL system packages...
wsl bash -c "command -v python3 && command -v pip3 && command -v gcc" >nul 2>&1
if !errorlevel! neq 0 (
    echo Installing development tools in WSL...
    wsl bash -c "sudo apt update && sudo apt install -y python3 python3-pip python3-venv python3-dev build-essential curl git libssl-dev libffi-dev"
    if !errorlevel! neq 0 (
        echo ERROR: Failed to install WSL system packages
        pause
        exit /b 1
    )
)
echo WSL system packages: OK

REM === Step 7: WSL Python Environment ===
echo [7/9] Setting up WSL Python environment...
if exist %WSL_VENV% (
    echo WSL environment exists, updating...
    wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && pip install --upgrade pip" >nul 2>&1
) else (
    echo Creating WSL environment...
    wsl bash -c "cd '!wsl_path!' && python3 -m venv %WSL_VENV%"
    if !errorlevel! neq 0 (
        echo ERROR: Failed to create WSL environment
        pause
        exit /b 1
    )
    wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && pip install --upgrade pip setuptools wheel"
)

REM === CUDA-enabled PyTorch, Triton, and moshi-server ===
echo Installing CUDA-enabled PyTorch, Triton, and moshi-server in WSL...
REM Uninstall any existing torch/torchaudio/torchvision to avoid CPU-only leftovers
wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && pip uninstall -y torch torchaudio torchvision"
REM Install CUDA-enabled PyTorch (default cu121, change PYTORCH_CUDA_VERSION if needed)
wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && pip install torch torchaudio --index-url https://download.pytorch.org/whl/%PYTORCH_CUDA_VERSION%"
if !errorlevel! neq 0 (
    echo ERROR: Failed to install CUDA-enabled PyTorch
    pause
    exit /b 1
)
REM Verify CUDA is available in torch
wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && python -c 'import torch; print(\"PyTorch CUDA version:\", torch.version.cuda); print(\"CUDA available:\", torch.cuda.is_available())'"
REM Install Triton
wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && pip install triton"
if !errorlevel! neq 0 (
    echo ERROR: Failed to install Triton
    pause
    exit /b 1
)
REM Install other backend dependencies
wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && pip install moshi flask flask-cors flask-socketio requests psutil numpy scipy librosa soundfile websockets msgpack pydantic"
if !errorlevel! neq 0 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)
REM Install Rust (cargo) in WSL if not already installed
wsl bash -c "command -v cargo >/dev/null 2>&1 || (curl https://sh.rustup.rs -sSf | sh -s -- -y)"
REM Install moshi-server with CUDA (source cargo env to ensure cargo is in PATH)
wsl bash -c "source $HOME/.cargo/env && cargo install --features cuda moshi-server"
if !errorlevel! neq 0 (
    echo ERROR: Failed to install moshi-server with CUDA
    pause
    exit /b 1
)
echo WSL environment: OK

REM === Step 8: Create Launch Scripts ===
echo [8/9] Creating launch scripts...

REM Create start-ui.bat with proper error handling and path resolution
echo @echo off > start-ui.bat
echo setlocal >> start-ui.bat
echo echo Starting Delayed Streams UI... >> start-ui.bat
echo. >> start-ui.bat
echo REM Check if virtual environment exists >> start-ui.bat
echo if not exist "%WINDOWS_VENV%\Scripts\activate.bat" ( >> start-ui.bat
echo     echo ERROR: Windows virtual environment not found >> start-ui.bat
echo     echo Please run setup_windows.bat first >> start-ui.bat
echo     pause >> start-ui.bat
echo     exit /b 1 >> start-ui.bat
echo ^) >> start-ui.bat
echo. >> start-ui.bat
echo REM Activate virtual environment >> start-ui.bat
echo call "%WINDOWS_VENV%\Scripts\activate.bat" >> start-ui.bat
echo if %%errorlevel%% neq 0 ( >> start-ui.bat
echo     echo ERROR: Failed to activate virtual environment >> start-ui.bat
echo     pause >> start-ui.bat
echo     exit /b 1 >> start-ui.bat
echo ^) >> start-ui.bat
echo. >> start-ui.bat
echo REM Check if ui directory exists >> start-ui.bat
echo if not exist "ui\run.py" ( >> start-ui.bat
echo     echo ERROR: ui\run.py not found >> start-ui.bat
echo     echo Please run this from the delayed-streams-ui directory >> start-ui.bat
echo     pause >> start-ui.bat
echo     exit /b 1 >> start-ui.bat
echo ^) >> start-ui.bat
echo. >> start-ui.bat
echo REM Change to ui directory and start >> start-ui.bat
echo cd ui >> start-ui.bat
echo set UI_SERVER_PORT=5000 >> start-ui.bat
echo set DEBUG_MODE=false >> start-ui.bat
echo echo Virtual environment activated successfully >> start-ui.bat
echo echo Starting Flask application... >> start-ui.bat
echo python run.py >> start-ui.bat
echo if %%errorlevel%% neq 0 ( >> start-ui.bat
echo     echo ERROR: Failed to start UI server >> start-ui.bat
echo ^) >> start-ui.bat
echo pause >> start-ui.bat

echo @echo off > start-backend.bat
echo setlocal >> start-backend.bat
echo echo Starting WSL backend... >> start-backend.bat
echo. >> start-backend.bat
echo REM Check WSL availability >> start-backend.bat
echo wsl --version ^>nul 2^>^&1 >> start-backend.bat
echo if %%errorlevel%% neq 0 ( >> start-backend.bat
echo     echo ERROR: WSL is not available >> start-backend.bat
echo     echo Please install WSL and run setup_windows.bat >> start-backend.bat
echo     pause >> start-backend.bat
echo     exit /b 1 >> start-backend.bat
echo ^) >> start-backend.bat
echo. >> start-backend.bat
echo wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && python backend_server.py" >> start-backend.bat
echo if %%errorlevel%% neq 0 ( >> start-backend.bat
echo     echo ERROR: Backend failed to start >> start-backend.bat
echo ^) >> start-backend.bat
echo pause >> start-backend.bat

echo Launch scripts: OK

REM === Step 9: Final Testing ===
echo [9/9] Testing installation...

REM Test Windows environment with full path
if exist "%WINDOWS_VENV%\Scripts\activate.bat" (
    call "%WINDOWS_VENV%\Scripts\activate.bat"
    python -c "import flask, flask_socketio; print('UI dependencies test passed')" >nul 2>&1
    if !errorlevel! neq 0 (
        echo WARNING: UI dependencies test failed - some packages may be missing
        echo Attempting to reinstall UI dependencies...
        pip install flask flask-cors flask-socketio requests psutil numpy websockets msgpack
    ) else (
        echo UI test: OK
    )
) else (
    echo WARNING: Windows virtual environment not found
)

REM Test WSL environment only if WSL is working
wsl echo "test" >nul 2>&1
if !errorlevel! equ 0 (
    wsl bash -c "cd '!wsl_path!' && source %WSL_VENV%/bin/activate && python -c 'import torch; print(\"Backend test passed\")'" >nul 2>&1
    if !errorlevel! neq 0 (
        echo WARNING: Backend test failed
    ) else (
        echo Backend test: OK
    )
) else (
    echo WARNING: WSL not available for backend testing
)

REM Test if Kyutai backend directory exists
if exist "delayed-streams-modeling" (
    echo Kyutai backend directory: OK
) else (
    echo WARNING: Kyutai backend directory not found
)

echo.
echo ================================
echo Installation Complete!
echo ================================
echo.
echo Repository structure:
echo   delayed-streams-ui/          (your UI frontend)
echo   delayed-streams-modeling/    (Kyutai's official backend)
echo.
echo To start the application:
echo   1. Run start-backend.bat (starts WSL backend)
echo   2. Run start-ui.bat (starts web interface)
echo   3. Open http://localhost:5000 in your browser
echo.
echo The backend must be running before starting the UI.
echo.

set /p start_now="Would you like to start the backend now? (y/n): "
if /i "!start_now!"=="y" (
    echo Starting backend...
    start start-backend.bat
    timeout /t 3 >nul
    echo Starting UI...
    start start-ui.bat
    echo.
    echo Both services are starting. Open http://localhost:5000 when ready.
)

pause
endlocal
