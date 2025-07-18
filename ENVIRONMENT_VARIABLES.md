# Environment Variables

This document describes the configurable environment variables for the Delayed Streams UI.

## Server Configuration

### `UI_SERVER_PORT`
- **Default:** `5000`
- **Description:** Port for the web UI server
- **Example:** `set UI_SERVER_PORT=8080`

### `TTS_SERVER_PORT`
- **Default:** `8080`
- **Description:** Port for the TTS (Text-to-Speech) server
- **Example:** `set TTS_SERVER_PORT=8081`

### `STT_SERVER_PORT`
- **Default:** `8080`
- **Description:** Port for the STT (Speech-to-Text) server
- **Example:** `set STT_SERVER_PORT=8082`

## WSL Configuration

### `WSL_DISTRIBUTION`
- **Default:** `Ubuntu`
- **Description:** WSL distribution to use for backend services
- **Example:** `set WSL_DISTRIBUTION=Ubuntu-20.04`

### `WSL_PROJECT_PATH`
- **Default:** Auto-detected
- **Description:** WSL path to the project directory
- **Example:** `set WSL_PROJECT_PATH=/mnt/c/my-project`

## Debug and Development

### `DEBUG_MODE`
- **Default:** `false`
- **Description:** Enable debug mode for Flask development server
- **Example:** `set DEBUG_MODE=true`

## Voice and Model Configuration

### `VOICE_FOLDER`
- **Default:** Auto-detected HuggingFace cache
- **Description:** Path to voice model files
- **Example:** `set VOICE_FOLDER=C:\voices`

## Usage Examples

### Basic Setup
```bash
# Use default settings
launch-ui.bat
```

### Custom Port Configuration
```bash
# Use custom ports
set UI_SERVER_PORT=8080
set TTS_SERVER_PORT=8081
set STT_SERVER_PORT=8082
launch-ui.bat
```

### Debug Mode
```bash
# Enable debug mode
set DEBUG_MODE=true
launch-ui.bat
```

### Custom WSL Distribution
```bash
# Use different WSL distribution
set WSL_DISTRIBUTION=Ubuntu-20.04
launch-ui.bat
```

## Notes

- Environment variables must be set before starting the application
- Port conflicts will cause startup failures
- WSL must be installed and the specified distribution must exist
- Debug mode should not be used in production 