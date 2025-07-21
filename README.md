# Delayed Streams UI Setup

*A portable web front end for Kyutai's open-source TTS/STT models (unofficial, unsupported, personal project)*

> **Disclaimer:** This project is an independent front end for Kyutai's open-source models. It is not affiliated with or endorsed by Kyutai. This is my first time doing this sort of coding and GitHub work—it's a personal side project, provided as-is, with no guarantees or support. I hope someone finds it useful!

## Quick Start (Windows)

1. Download or clone this repository.
2. **Only use the setup scripts in the project root.**
3. Open a Command Prompt or PowerShell window in the project directory.
4. Run the setup script:
   ```
   setup_windows.bat
   ```
5. **Follow any prompts.**  
   - The script will automatically install Python (if needed), all dependencies, clone both the backend and UI repos, and set up a virtual environment.
   - If you see a warning about WSL (Windows Subsystem for Linux), follow the instructions to install it for backend (Rust STT/TTS) support.

6. To start the UI:
   Run the start script:
   ```
   start-ui.bat
   ```  
   Then open [http://localhost:5000](http://localhost:5000) in your browser.

**Notes:**
- The script installs the CUDA (GPU) version of PyTorch by default. You need a compatible NVIDIA GPU and drivers for GPU acceleration.
- If you do not have a compatible GPU, you may need to manually install the CPU version of PyTorch.
- WSL is required for the backend (Rust STT/TTS server). If not installed, the script will prompt you with instructions.
- **Do not use any install or setup scripts inside the `/ui/` folder. All setup should be done from the project root.**

---

## Quick Start (Linux)

1. Download or clone this repository.
2. **Only use the setup scripts in the project root.**
3. Open a terminal in the project directory.
4. Run the setup script:
   ```
   bash setup_linux.sh
   ```
5. Follow the prompts to complete the setup.

6. To start the UI:
   ```
   cd delayed-streams-ui
   source tts-venv/bin/activate
   python run.py
   ```
   Then open [http://localhost:5000](http://localhost:5000) in your browser.

**Notes:**
- The Linux script installs the CUDA (GPU) version of PyTorch by default for GPU acceleration. You need a compatible NVIDIA GPU and drivers.
- If you do not have a compatible GPU, you may need to manually install the CPU version of PyTorch.
- **Do not use any install or setup scripts inside the `/ui/` folder. All setup should be done from the project root.**

---

## Backend and UI
- The setup scripts will clone both the backend (Kyutai's delayed-streams-modeling) and the UI (delayed-streams-ui) repositories.
- All dependencies are installed automatically.

---

## Troubleshooting
- If you encounter issues with CUDA or GPU support, check your NVIDIA driver and CUDA toolkit installation.
- If WSL is not installed on Windows, follow the script's prompt or see [https://aka.ms/wslinstall](https://aka.ms/wslinstall).
- For CPU-only PyTorch, see [PyTorch Get Started](https://pytorch.org/get-started/locally/).

## Credits
- **Kyutai** for the TTS/STT models and backend: [kyutai-labs/delayed-streams-modeling](https://github.com/kyutai-labs/delayed-streams-modeling)
- This front end is an independent project to provide a user-friendly interface for Kyutai's models.

## License
MIT License (see LICENSE file)
