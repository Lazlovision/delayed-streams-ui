#!/bin/bash
set -e

# ================================
# Delayed Streams UI Setup Script
# ================================

# === Configuration Variables ===
PYTHON_MIN_MAJOR=3
PYTHON_MIN_MINOR=10
VENV_DIR="tts-venv"

# === Helper Functions ===
function check_command() {
    command -v "$1" >/dev/null 2>&1
}

function check_python_version() {
    echo "Checking Python version..."
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    echo "Found Python $PYTHON_MAJOR.$PYTHON_MINOR"
    if [ "$PYTHON_MAJOR" -gt $PYTHON_MIN_MAJOR ] || { [ "$PYTHON_MAJOR" -eq $PYTHON_MIN_MAJOR ] && [ "$PYTHON_MINOR" -ge $PYTHON_MIN_MINOR ]; }; then
        return 0
    else
        echo "ERROR: Python $PYTHON_MAJOR.$PYTHON_MINOR is too old - need $PYTHON_MIN_MAJOR.$PYTHON_MIN_MINOR+"
        return 1
    fi
}

# === Step 1: Check Prerequisites ===
echo "[1/8] Checking prerequisites..."

# Check Git
echo "Checking Git installation..."
if ! check_command git; then
    echo "ERROR: Git is not installed or not in PATH"
    echo "Please install Git using your package manager (e.g., sudo apt install git)"
    exit 1
fi
echo "Git: OK"

# Check Python
echo "Checking Python installation..."
if ! check_command python3; then
    echo "ERROR: Python 3 is not installed. Please install Python 3.10+ using your package manager."
    exit 1
fi
if ! check_python_version; then
    exit 1
fi
echo "Python: OK"

# Check project structure
if [ ! -f "ui/run.py" ]; then
    echo "ERROR: ui/run.py not found"
    echo "Please run this script from the delayed-streams-ui directory"
    exit 1
fi
echo "Project structure: OK"

# === Step 2: Setting up Python virtual environment ===
echo "[2/8] Setting up Python virtual environment..."
if [ -d "$VENV_DIR" ]; then
    echo "Virtual environment exists, updating..."
    source "$VENV_DIR/bin/activate"
    python3 -m pip install --upgrade pip
else
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    python3 -m pip install --upgrade pip
fi
echo "Virtual environment: OK"

# === Step 3: Installing backend dependencies ===
echo "[3/8] Installing backend dependencies..."
pip install -r backend/README.md 2>/dev/null || true # No backend requirements.txt, skip

# === Step 4: Installing UI dependencies ===
echo "[4/8] Installing UI dependencies..."
pip install -r ui/requirements.txt

echo "[5/8] Setup complete!"
