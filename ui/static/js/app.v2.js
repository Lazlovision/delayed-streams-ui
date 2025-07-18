console.log('JS version check: app.v2.js loaded');
// Remove the annoying alert
// window.alert('JS version check: app.v2.js loaded');
console.log('DEBUG: JS version 2025-07-06-4 loaded');

const form = document.getElementById('ttsForm');
const textInput = document.getElementById('textInput');
const voiceSelect = document.getElementById('voiceSelect');
const generateBtn = document.getElementById('generateBtn');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const resultMessage = document.getElementById('resultMessage');
const audioPlayer = document.getElementById('audioPlayer');
const charCount = document.getElementById('charCount');
const debugInfo = document.getElementById('debugInfo');
const debugText = document.getElementById('debugText');
const backendInfo = document.getElementById('backendInfo');

let availableVoices = [];
let selectedBackend = 'pytorch';
let timerInterval = null;
let timerStart = null;
let isGenerating = false;
let cancelRequested = false;

// === TTS/STT Mode Switcher ===
const switchTTS = document.getElementById('switchTTS');
const switchSTT = document.getElementById('switchSTT');
const ttsForm = document.getElementById('ttsForm');
const sttForm = document.getElementById('sttForm');

function showTTS() {
    ttsForm.style.display = '';
    sttForm.style.display = 'none';
    switchTTS.classList.add('active');
    switchSTT.classList.remove('active');
    if (typeof result !== 'undefined' && result) {
        result.style.display = 'none';
    }
    if (typeof audioPlayer !== 'undefined' && audioPlayer) {
        audioPlayer.style.display = 'none';
    }
    if (typeof sttResult !== 'undefined' && sttResult) {
        sttResult.style.display = 'none';
    }
    const liveTranscriptDiv = document.getElementById('liveTranscript');
    if (liveTranscriptDiv) {
        liveTranscriptDiv.style.display = 'none';
    }
    // Hide the transcription result when switching to TTS mode
    const transcriptionResult = document.getElementById('transcriptionResult');
    if (transcriptionResult) {
        transcriptionResult.style.display = 'none';
    }
    const ttsHelp = document.getElementById('ttsHelp');
    const sttHelp = document.getElementById('sttHelp');
    if (ttsHelp) ttsHelp.style.display = '';
    if (sttHelp) sttHelp.style.display = 'none';
    if (typeof updateDebugInfo === 'function') {
        updateDebugInfo('[UI] Switched to Text-to-Speech mode');
    }
    // Always re-poll TTS server status and update button/message
    pollTTSServerStatus();
    if (selectedBackend === 'rust') {
        generateBtn.disabled = !ttsServerIsOnline;
        if (!ttsServerIsOnline) {
            ttsServerMsg.textContent = 'Please start the Rust server before generating speech.';
        } else {
            ttsServerMsg.textContent = '';
        }
    } else {
        generateBtn.disabled = false;
        ttsServerMsg.textContent = '';
    }
}
function showSTT() {
    ttsForm.style.display = 'none';
    sttForm.style.display = '';
    switchTTS.classList.remove('active');
    switchSTT.classList.add('active');
    if (typeof result !== 'undefined' && result) {
        result.style.display = 'none';
    }
    if (typeof audioPlayer !== 'undefined' && audioPlayer) {
        audioPlayer.style.display = 'none';
    }
    if (typeof sttResult !== 'undefined' && sttResult && sttResultMessage && sttResultMessage.innerHTML.trim() !== '') {
        sttResult.style.display = 'block';
    }
    const liveTranscriptDiv = document.getElementById('liveTranscript');
    if (liveTranscriptDiv && liveTranscriptDiv.querySelector('#liveTranscriptText').textContent.trim() !== '') {
        liveTranscriptDiv.style.display = 'block';
    }
    // Show the transcription result when switching to STT mode (if it has content)
    const transcriptionResult = document.getElementById('transcriptionResult');
    const transcriptionResultText = document.getElementById('transcriptionResultText');
    if (transcriptionResult && transcriptionResultText && transcriptionResultText.textContent.trim() !== '') {
        transcriptionResult.style.display = 'block';
    } else if (transcriptionResult) {
        transcriptionResult.style.display = 'none';
    }
    const ttsHelp = document.getElementById('ttsHelp');
    const sttHelp = document.getElementById('sttHelp');
    if (ttsHelp) ttsHelp.style.display = 'none';
    if (sttHelp) sttHelp.style.display = '';
    selectSTTBackend(selectedSTTBackend);
    selectSTTModel(selectedSTTModel);
    if (typeof updateDebugInfo === 'function') {
        updateDebugInfo('[UI] Switched to Speech-to-Text mode');
    }
}
if (switchTTS && switchSTT && ttsForm && sttForm) {
    switchTTS.addEventListener('click', showTTS);
    switchSTT.addEventListener('click', showSTT);
}

// Add Clear Debug button with proper styling
let clearDebugBtn = document.getElementById('clearDebugBtn');
if (!clearDebugBtn) {
    // Create a container div for centering
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'center';
    buttonContainer.style.marginTop = '8px';
    buttonContainer.style.marginBottom = '4px';
    
    clearDebugBtn = document.createElement('button');
    clearDebugBtn.id = 'clearDebugBtn';
    clearDebugBtn.textContent = 'Clear Debug';
    
    // Style the button to match your theme
    clearDebugBtn.style.fontSize = '12px';
    clearDebugBtn.style.padding = '6px 12px';
    clearDebugBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    clearDebugBtn.style.color = 'white';
    clearDebugBtn.style.border = 'none';
    clearDebugBtn.style.borderRadius = '6px';
    clearDebugBtn.style.cursor = 'pointer';
    clearDebugBtn.style.fontWeight = '500';
    clearDebugBtn.style.transition = 'all 0.3s ease';
    clearDebugBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    clearDebugBtn.style.display = 'inline-block';
    
    // Add hover effect
    clearDebugBtn.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-1px)';
        this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    });
    clearDebugBtn.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    });
    
    // Add button to container, then container to DOM
    buttonContainer.appendChild(clearDebugBtn);
    debugInfo.parentNode.insertBefore(buttonContainer, debugInfo.nextSibling);
}
clearDebugBtn.addEventListener('click', function() {
    debugText.innerHTML = '';
});

// Helper function to update debug info and auto-scroll
function updateDebugInfo(newContent) {
    // Add timestamp
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    // Create a new div element for the message with zero spacing
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `[${timestamp}] ${newContent}`;
    messageDiv.style.cssText = `
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1.2 !important;
        font-size: 12px !important;
        font-family: monospace !important;
        border: none !important;
        display: block !important;
        height: auto !important;
        min-height: 0 !important;
        white-space: nowrap !important;
    `;
    
    // Append the message element
    debugText.appendChild(messageDiv);
    
    // Keep only last 100 messages
    const children = debugText.children;
    if (children.length > 100) {
        for (let i = 0; i < children.length - 100; i++) {
            debugText.removeChild(children[0]);
        }
    }
    debugInfo.style.display = 'block';
    // Auto-scroll to bottom with a slight delay to ensure content is rendered
    setTimeout(() => {
        debugInfo.scrollTop = debugInfo.scrollHeight;
    }, 0);
}

// === Rust Server Status UI ===
const rustServerStatusRow = document.getElementById('rustServerStatusRow');
const rustServerStatusText = document.getElementById('rustServerStatusText');
const rustServerControlBtn = document.getElementById('rustServerControlBtn');
const rustServerErrorDiv = document.createElement('div');
rustServerErrorDiv.id = 'rustServerErrorDiv';
rustServerErrorDiv.style.display = 'none';
rustServerErrorDiv.style.color = '#b71c1c';
rustServerErrorDiv.style.fontSize = '13px';
rustServerErrorDiv.style.marginTop = '6px';
// FIX: Use the real DOM element for the log div
const rustServerLogDiv = document.getElementById('rustServerLogDiv');
rustServerLogDiv.style.display = 'none';
rustServerLogDiv.style.fontSize = '12px';
rustServerLogDiv.style.color = '#444';
rustServerLogDiv.style.background = 'rgba(255,255,255,0.7)';
rustServerLogDiv.style.borderRadius = '4px';
rustServerLogDiv.style.padding = '6px 10px';
rustServerLogDiv.style.maxHeight = '90px';
rustServerLogDiv.style.overflowY = 'auto';
if (rustServerStatusRow && !document.getElementById('rustServerErrorDiv')) {
    rustServerStatusRow.parentNode.insertBefore(rustServerErrorDiv, rustServerStatusRow.nextSibling);
}
if (rustServerStatusRow && !document.getElementById('rustServerLogDiv')) {
    rustServerStatusRow.parentNode.insertBefore(rustServerLogDiv, rustServerStatusRow.nextSibling);
}
let rustServerLogPoller = null;

// === Rust STT Server Status UI ===
const sttServerStatusRow = document.getElementById('sttServerStatusRow');
const sttServerStatusText = document.getElementById('sttServerStatusText');
const sttServerControlBtn = document.getElementById('sttServerControlBtn');
const sttServerErrorDiv = document.createElement('div');
sttServerErrorDiv.id = 'sttServerErrorDiv';
sttServerErrorDiv.style.display = 'none';
sttServerErrorDiv.style.color = '#b71c1c';
sttServerErrorDiv.style.fontSize = '13px';
sttServerErrorDiv.style.marginTop = '6px';
const sttServerLogDiv = document.createElement('div');
sttServerLogDiv.id = 'sttServerLogDiv';
sttServerLogDiv.style.display = 'none';
sttServerLogDiv.style.fontSize = '12px';
sttServerLogDiv.style.color = '#444';
sttServerLogDiv.style.background = 'rgba(255,255,255,0.7)';
sttServerLogDiv.style.borderRadius = '4px';
sttServerLogDiv.style.padding = '6px 10px';
sttServerLogDiv.style.maxHeight = '90px';
sttServerLogDiv.style.overflowY = 'auto';
if (sttServerStatusRow && !document.getElementById('sttServerErrorDiv')) {
    sttServerStatusRow.parentNode.insertBefore(sttServerErrorDiv, sttServerStatusRow.nextSibling);
}
if (sttServerStatusRow && !document.getElementById('sttServerLogDiv')) {
    sttServerStatusRow.parentNode.insertBefore(sttServerLogDiv, sttServerStatusRow.nextSibling);
}
let sttServerStatusPoller = null;
let sttServerLogPoller = null;



// This function is deprecated - use showTTSServerStatusRow instead
function showRustServerStatusRow(show) {
    // Redirect to the correct TTS server status function
    showTTSServerStatusRow(show);
}


if (rustServerControlBtn) {
    rustServerControlBtn.addEventListener('click', async function() {
        if (rustServerControlBtn.textContent.includes('Start')) {
            const originalText = addServerSpinner(rustServerControlBtn);
            await fetch('/api/start-rust-tts-server', { method: 'POST' });
            // Now set UI to starting (disable button, show spinner)
            setTTSServerButtonState('starting');
            setTimeout(() => {
                pollTTSServerStatus();
                removeServerSpinner(rustServerControlBtn, originalText);
            }, 1000);
        } else if (rustServerControlBtn.textContent.includes('Shutdown')) {
            setTTSServerButtonState('stopping');
            await fetch('/api/stop-rust-tts-server', { method: 'POST' });
            setTimeout(() => {
                pollTTSServerStatus();
            }, 1000);
        }
    });
}

// === STT Server Management Functions ===
function updateSTTServerStatusUI(status, url) {
    if (!sttServerStatusText) return;
    let statusText = status.charAt(0).toUpperCase() + status.slice(1);
    if (status === 'online' && url) {
        statusText += ` (${url})`;
    }
    sttServerStatusText.textContent = statusText;
    sttServerStatusText.className = status;
    
    // Call the button state function to handle spinner and startup log
    setSTTServerButtonState(status);
    
    // Show error if status is error
    if (status === 'error') {
        fetch('/api/rust-stt-server-error').then(r => r.json()).then(data => {
            sttServerErrorDiv.textContent = 'STT server failed to start: ' + (data.error || 'Unknown error');
            sttServerErrorDiv.style.display = '';
        });
    } else {
        sttServerErrorDiv.style.display = 'none';
        sttServerErrorDiv.textContent = '';
    }
}

async function pollSTTServerStatus() {
    try {
        const resp = await fetch('/api/rust-stt-server-status');
        const data = await resp.json();
        let status = data.status;
        updateSTTServerStatusUI(status, data.url);
        updateSTTModelLock(status);
        attachSTTServerControlHandler();
        // Initialize STT server log polling
        pollSTTServerLog();
    } catch (e) {
        updateSTTServerStatusUI('offline');
        updateSTTModelLock('offline');
        attachSTTServerControlHandler();
    }
}

function showSTTServerStatusRow(show) {
    if (sttServerStatusRow) {
        sttServerStatusRow.style.display = show ? 'flex' : 'none';
    }
    if (show) {
        pollSTTServerStatus();
        if (!sttServerStatusPoller) {
            sttServerStatusPoller = setInterval(pollSTTServerStatus, 5000);
        }
    } else {
        if (sttServerStatusPoller) {
            clearInterval(sttServerStatusPoller);
            sttServerStatusPoller = null;
        }
        sttServerErrorDiv.style.display = 'none';
        sttServerErrorDiv.textContent = '';
    }
}

async function pollSTTServerLog() {
    try {
        const resp = await fetch('/api/rust-stt-server-log');
        const data = await resp.json();
        // Use the real DOM element
        const sttServerLogDiv = document.getElementById('sttServerLogDiv');
        if (data.log && data.log.length > 0) {
            sttServerLogDiv.innerHTML = data.log.map(line => `<div style="margin: 2px 0; font-family: monospace; font-size: 11px;">${line.replace(/\[Rust STT Server\] ?/, '')}</div>`).join('');
            sttServerLogDiv.style.display = 'block';
            sttServerLogDiv.style.maxHeight = '120px';
            sttServerLogDiv.style.overflowY = 'auto';
            sttServerLogDiv.style.background = '#f8f9fa';
            sttServerLogDiv.style.border = '1px solid #e0e0e0';
            sttServerLogDiv.style.borderRadius = '4px';
            sttServerLogDiv.style.padding = '8px';
        } else {
            sttServerLogDiv.style.display = 'none';
            sttServerLogDiv.innerHTML = '';
        }
    } catch (e) {
        const sttServerLogDiv = document.getElementById('sttServerLogDiv');
        sttServerLogDiv.style.display = 'none';
        sttServerLogDiv.innerHTML = '';
    }
}

function showSTTServerLog(show) {
    if (show) {
        pollSTTServerLog();
        if (!sttServerLogPoller) {
            sttServerLogPoller = setInterval(pollSTTServerLog, 5000);
        }
    } else {
        if (sttServerLogPoller) {
            clearInterval(sttServerLogPoller);
            sttServerLogPoller = null;
        }
        sttServerLogDiv.style.display = 'none';
        sttServerLogDiv.innerHTML = '';
    }
}

// === Patch backend selection logic to show/hide Rust server status ===
function selectBackend(backend) {
    selectedBackend = backend;
    document.querySelectorAll('.backend-option').forEach(option => {
        option.classList.remove('selected');
    });
    event.target.closest('.backend-option').classList.add('selected');
    document.getElementById(backend).checked = true;
    if (backend === 'pytorch') {
        backendInfo.innerHTML = '<strong>PyTorch Backend:</strong> Direct PyTorch implementation, no server required. Generally faster startup and more reliable.';
        showTTSServerStatusRow(false);
        generateBtn.disabled = false;
        ttsServerMsg.textContent = '';
    } else {
        backendInfo.innerHTML = '<strong>Rust Server Backend:</strong> Requires the Rust server to be running separately. Server can take several minutes to start up, but generations can be as fast as a few seconds each.';
        showTTSServerStatusRow(true);
        generateBtn.disabled = !ttsServerIsOnline;
        if (!ttsServerIsOnline) {
            ttsServerMsg.textContent = 'Please start the Rust server before generating speech.';
        } else {
            ttsServerMsg.textContent = '';
        }
    }
    updateDebugInfo(`Backend switched to: ${backend}`);
}

// Load available voices when page loads
window.addEventListener('DOMContentLoaded', function() {
    loadVoices();
    // Show TTS by default on load (moved here to avoid ReferenceError)
    showTTS();
    // Initialize TTS server status polling
    pollTTSServerStatus();
    attachTTSServerControlHandler();
    // Initialize TTS server log polling
    pollTTSServerLog();
});

async function loadVoices() {
    try {
        const response = await fetch('/api/voices');
        const data = await response.json();
        if (data.voices && data.voices.length > 0) {
            availableVoices = data.voices;
            voiceSelect.innerHTML = '<option value="">Select a voice...</option>';
            data.voices.forEach((voice, idx) => {
                const option = document.createElement('option');
                option.value = voice.id;
                // Only show the display name (voice.name)
                option.textContent = voice.name;
                voiceSelect.appendChild(option);
            });
            // Automatically select the first real voice if available
            if (voiceSelect.options.length > 1) {
                voiceSelect.selectedIndex = 1;
            }
        } else {
            voiceSelect.innerHTML = '<option value="">No voices available</option>';
            showResult('No voices found. Please check your voice folder configuration.', 'error');
        }
    } catch (error) {
        console.error('Error loading voices:', error);
        voiceSelect.innerHTML = '<option value="">Error loading voices</option>';
        showResult('Error loading voices. Please check if the server is running.', 'error');
    }
}

// Character counter
textInput.addEventListener('input', function() {
    const count = this.value.length;
    charCount.textContent = count;
    if (count > 4500) {
        charCount.style.color = '#f44336';
    } else if (count > 4000) {
        charCount.style.color = '#ff9800';
    } else {
        charCount.style.color = '#888';
    }
});

// Cancel handler (global so we can remove it)
function handleCancelGlobal() {
    cancelRequested = true;
    generateBtn.disabled = true;
    fetch('/api/cancel', { method: 'POST' })
        .then(() => {
            showResult('Generation cancelled.', 'error');
            resetUI();
        });
}

// Form submission
form.addEventListener('submit', handleFormSubmit);

async function handleFormSubmit(e) {
    e.preventDefault();
    if (isGenerating) return; // Prevent double submits
    isGenerating = true;
    cancelRequested = false;
    const text = textInput.value.trim();
    const voice = voiceSelect.value;
    if (!text || !voice) {
        showResult('Please fill in all fields.', 'error');
        isGenerating = false;
        return;
    }
    // Find selected voice details for debugging
    const selectedVoice = availableVoices.find(v => v.id === voice);
    if (selectedVoice) {
        updateDebugInfo(`Generating with voice: ${selectedVoice.name} (${selectedVoice.id}), backend: ${selectedBackend}`);
    }
    // Show loading state
    console.log('DEBUG: About to set button to Cancel');
    generateBtn.disabled = false;
    generateBtn.textContent = 'Cancel';
    console.log('DEBUG: Button text after set:', generateBtn.textContent);
    loading.style.display = 'block';
    result.style.display = 'none';
    audioPlayer.style.display = 'none';
    // Start timer
    const timerElem = document.getElementById('timer');
    timerStart = Date.now();
    timerElem.textContent = 'Elapsed: 0.0s';
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const elapsed = (Date.now() - timerStart) / 1000;
        timerElem.textContent = `Elapsed: ${elapsed.toFixed(1)}s`;
    }, 100);

    // Attach cancel handler (cleanup first)
    generateBtn.removeEventListener('click', handleCancelGlobal);
    setTimeout(() => {
        generateBtn.removeEventListener('click', handleCancelGlobal);
        generateBtn.addEventListener('click', handleCancelGlobal);
    }, 0);
    console.log('DEBUG: Cancel handler attached');

    try {
        // Prepare the request data
        const requestData = {
            text: text,
            voice: voice,
            backend: selectedBackend
        };
        // Make the API call to your server
        const response = await fetch('/api/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        if (cancelRequested) return;
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        // Get the audio file as a blob (original backend behavior)
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        // Set up the audio player
        audioPlayer.src = audioUrl;
        audioPlayer.style.display = 'block';
        // Calculate elapsed time
        const elapsed = ((Date.now() - timerStart) / 1000).toFixed(2);
        showResult(`Speech generated successfully! 🎉<br><strong>Backend:</strong> ${selectedBackend}<br><strong>Generation time:</strong> ${elapsed}s`, 'success');
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = audioUrl;
        downloadLink.download = `output_${selectedBackend}.wav`;
        downloadLink.textContent = '📥 Download Audio File';
        downloadLink.style.display = 'block';
        downloadLink.style.marginTop = '10px';
        downloadLink.style.color = '#667eea';
        downloadLink.style.textDecoration = 'none';
        downloadLink.style.fontWeight = '500';
        downloadLink.style.padding = '8px 16px';
        downloadLink.style.background = 'rgba(102, 126, 234, 0.1)';
        downloadLink.style.borderRadius = '5px';
        downloadLink.style.border = '1px solid rgba(102, 126, 234, 0.2)';
        downloadLink.style.transition = 'all 0.3s ease';
        downloadLink.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(102, 126, 234, 0.2)';
        });
        downloadLink.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(102, 126, 234, 0.1)';
        });
        resultMessage.appendChild(downloadLink);
    } catch (error) {
        if (!cancelRequested) {
            console.error('Error:', error);
            showResult(`Error: ${error.message}`, 'error');
        }
    } finally {
        resetUI();
    }
}

function resetUI() {
    isGenerating = false;
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Speech';
    loading.style.display = 'none';
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    const timerElem = document.getElementById('timer');
    timerElem.textContent = 'Elapsed: 0.0s';
    // Remove cancel handler
    generateBtn.removeEventListener('click', handleCancelGlobal);
}

function showResult(message, type) {
    result.className = `result ${type}`;
    result.style.display = 'block';
    
    // Clean up the message to remove backend info for success messages
    if (type === 'success' && message.includes('Backend:')) {
        // Remove the backend info line
        message = message.replace(/<br><strong>Backend:<\/strong>.*?<br>/, '<br>');
        message = message.replace(/<br><strong>Backend:<\/strong>.*?$/, '');
    }
    
    resultMessage.innerHTML = message;
}

// Add some nice hover effects
document.querySelectorAll('input, textarea, select').forEach(element => {
    element.addEventListener('focus', function() {
        this.style.transform = 'scale(1.02)';
    });
    element.addEventListener('blur', function() {
        this.style.transform = 'scale(1)';
    });
});

// Fix debug info styling to eliminate blank lines
if (debugInfo) {
    debugInfo.style.height = '200px';
    debugInfo.style.overflowY = 'auto';
    debugInfo.style.minHeight = '0';
    debugInfo.style.maxHeight = 'none';
    debugInfo.style.padding = '8px';
    debugInfo.style.margin = '0';
    debugInfo.style.borderBottomLeftRadius = '0';
    debugInfo.style.borderBottomRightRadius = '0';
    debugInfo.style.boxSizing = 'border-box';
    debugInfo.style.display = 'block';
    debugInfo.style.lineHeight = '1.2';
}

// Fix debug text styling to eliminate extra spacing
if (debugText) {
    debugText.style.padding = '0';
    debugText.style.margin = '0';
    debugText.style.lineHeight = '1.2';
    debugText.style.fontSize = '12px';
    debugText.style.fontFamily = 'monospace';
    debugText.style.height = '100%';
    debugText.style.boxSizing = 'border-box';
}

// === STT (Speech-to-Text) Form Handling ===
const audioInput = document.getElementById('audioInput');
const sttResult = document.getElementById('sttResult');
const sttResultMessage = document.getElementById('sttResultMessage');

// === Custom File Input for STT ===
const customFileBtn = document.getElementById('customFileBtn');
const selectedFileName = document.getElementById('selectedFileName');
// Remove duplicate event listeners for customFileBtn and audioInput
if (customFileBtn && audioInput && selectedFileName) {
    customFileBtn.onclick = function() {
        audioInput.click();
    };
    audioInput.onchange = function(e) {
        if (audioInput.files && audioInput.files.length > 0) {
            updateSelectedFileName(audioInput.files[0].name);
            updateAudioInputStatus('File selected: ' + audioInput.files[0].name);
            // Also create audio preview here
            const file = audioInput.files[0];
            if (file) {
                const audioUrl = URL.createObjectURL(file);
                createAudioPreview(audioUrl);
            }
        } else {
            updateSelectedFileName();
            updateAudioInputStatus();
        }
    };
}

// === STT Model Toggle ===
let selectedSTTModel = 'kyutai/stt-1b-en_fr';
let selectedSTTBackend = 'pytorch';

function selectSTTModel(model) {
    selectedSTTModel = model;
    // Update UI
    document.querySelectorAll('#sttModelSelector .backend-option').forEach(option => {
        option.classList.remove('selected');
    });
    const radio = document.querySelector(`#sttModelSelector input[value='${model}']`);
    if (radio) {
        radio.checked = true;
        radio.closest('.backend-option').classList.add('selected');
    }
    // Log debug info for model switching
    if (typeof updateDebugInfo === 'function') {
        updateDebugInfo(`[UI] Switched STT model to: ${model}`);
    }
}

// --- PATCH: Show/hide spinner next to status text, not in button ---
function setSTTServerButtonState(state) {
    const spinner = document.getElementById('sttServerSpinner');
    const startupLogBox = document.getElementById('sttStartupLogBox');
    if (!sttServerControlBtn) return;
    if (spinner) spinner.style.display = 'none';
    if (startupLogBox) startupLogBox.style.display = 'none';
    const normalized = (state || '').toLowerCase().trim();
    
    if (normalized === 'starting') {
        sttServerControlBtn.disabled = true;
        sttServerControlBtn.textContent = '⏳ Starting...';
        if (spinner) spinner.style.display = 'inline-block';
        if (startupLogBox) startupLogBox.style.display = 'block';
        showSTTServerLog(true);
    } else if (normalized === 'stopping') {
        sttServerControlBtn.disabled = true;
        sttServerControlBtn.textContent = '⏻ Stopping...';
        if (spinner) spinner.style.display = 'inline-block';
        if (startupLogBox) startupLogBox.style.display = 'block';
        showSTTServerLog(true);
    } else if (normalized === 'online') {
        sttServerControlBtn.disabled = false;
        sttServerControlBtn.textContent = 'Shutdown STT Server';
        if (spinner) spinner.style.display = 'none';
        if (startupLogBox) startupLogBox.style.display = 'none';
        showSTTServerLog(false);
    } else {
        // offline or any other state
        sttServerControlBtn.disabled = false;
        sttServerControlBtn.textContent = 'Start STT Server';
        if (spinner) spinner.style.display = 'none';
        if (startupLogBox) startupLogBox.style.display = 'none';
        showSTTServerLog(false);
    }
}

// --- PATCH: Always maintain model selection visually ---
function selectSTTModel(model) {
    document.querySelectorAll('#sttModelSelector .backend-option').forEach(opt => opt.classList.remove('selected'));
    const radio = document.querySelector(`#sttModelSelector input[value='${model}']`);
    if (radio) {
        radio.checked = true;
        radio.closest('.backend-option').classList.add('selected');
    }
    selectedSTTModel = model;
    if (typeof updateDebugInfo === 'function') {
        updateDebugInfo(`[UI] Switched STT model to: ${model}`);
    }
}

// --- PATCH: Always maintain model selection on backend switch and server status change ---
function selectSTTBackend(backend) {
    selectedSTTBackend = backend;
    document.querySelectorAll('#sttForm .backend-selector .backend-option').forEach(option => {
        option.classList.remove('selected');
    });
    const radio = document.querySelector(`#sttForm input[name='stt-backend'][value='${backend}']`);
    if (radio) {
        radio.checked = true;
        radio.closest('.backend-option').classList.add('selected');
    }
    // Always ensure a model is selected and visually highlighted
    const checkedModel = document.querySelector('#sttModelSelector input[name="stt-model"]:checked');
    if (!checkedModel) {
        selectSTTModel('kyutai/stt-1b-en_fr');
    } else {
        selectSTTModel(checkedModel.value);
    }
    // Update backend info text
    const sttBackendInfo = document.getElementById('sttBackendInfo');
    if (sttBackendInfo) {
        if (backend === 'pytorch') {
            sttBackendInfo.innerHTML = '<strong>PyTorch Backend:</strong> Direct PyTorch implementation, no server required. Generally for research and one-off transcriptions.';
            showSTTServerStatusRow(false);
        } else if (backend === 'rust') {
            sttBackendInfo.innerHTML = '<strong>Rust Backend:</strong> Rust server implementation. Requires server to be running. Server can take several minutes to start up, but transcriptions can be as fast as a few seconds each.';
            showSTTServerStatusRow(true);
        }
    }
    if (typeof updateDebugInfo === 'function') {
        updateDebugInfo(`[UI] Switched STT backend to: ${backend}`);
    }
}

// --- PATCH: Update audio input status text in tooltip location ---
function updateAudioInputStatus(text) {
    const status = document.getElementById('audioInputStatus');
    if (status) {
        status.textContent = text || 'No audio selected or recorded yet. Ready for upload, recording, or live transcription.';
    }
}

// Update file input and recording logic to use updateAudioInputStatus
if (customFileBtn && audioInput) {
    // Remove duplicate event listeners - this is handled above
    // customFileBtn.addEventListener('click', function() {
    //     audioInput.click();
    // });
    // audioInput.addEventListener('change', function() {
    //     if (audioInput.files && audioInput.files.length > 0) {
    //         updateSelectedFileName(audioInput.files[0].name);
    //         updateAudioInputStatus('File selected: ' + audioInput.files[0].name);
    //     } else {
    //         updateSelectedFileName();
    //         updateAudioInputStatus();
    //     }
    // });
}

// Set default visually on load
selectSTTModel(selectedSTTModel);
selectSTTBackend(selectedSTTBackend);

// --- PATCH: Always select 1B model on STT mode switch and page load, and apply .selected class ---
function ensure1BModelSelected() {
    const oneBOption = document.querySelector('#sttModelSelector .backend-option input[value="kyutai/stt-1b-en_fr"]');
    if (oneBOption) {
        oneBOption.checked = true;
        document.querySelectorAll('#sttModelSelector .backend-option').forEach(opt => opt.classList.remove('selected'));
        oneBOption.closest('.backend-option').classList.add('selected');
    }
}
window.addEventListener('DOMContentLoaded', ensure1BModelSelected);
if (switchSTT) {
    switchSTT.addEventListener('click', ensure1BModelSelected);
}

// --- PATCH: Lock/unlock model selector with .disabled class and show/hide note ---
function updateSTTModelLock(status) {
    const selector = document.getElementById('sttModelSelector');
    const lockNote = document.getElementById('sttModelLockNote');
    if (status === 'online' || status === 'starting') {
        if (selector) selector.classList.add('disabled');
        if (lockNote) lockNote.style.display = '';
    } else {
        if (selector) selector.classList.remove('disabled');
        if (lockNote) lockNote.style.display = 'none';
    }
    // Also update cursor for all model options
    document.querySelectorAll('#sttModelSelector .backend-option').forEach(option => {
        if (selector && selector.classList.contains('disabled')) {
            option.style.cursor = 'not-allowed';
        } else {
            option.style.cursor = 'pointer';
        }
    });
}

// --- PATCH: Add debug logging to STT server start button ---
function attachSTTServerControlHandler() {
    if (!sttServerControlBtn) return;
    sttServerControlBtn.onclick = async function() {
        if (sttServerControlBtn.textContent.includes('Start')) {
            setSTTServerButtonState('starting');
            updateDebugInfo('[UI] Attempting to start STT server...');
            try {
                const response = await fetch('/api/start-rust-stt-server', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: selectedSTTModel })
                });
                if (response.ok) {
                    updateDebugInfo('[UI] STT server start command sent successfully');
                } else {
                    updateDebugInfo('[UI] STT server start command failed');
                }
            } catch (error) {
                updateDebugInfo(`[UI] STT server start error: ${error.message}`);
            }
            setTimeout(() => {
                pollSTTServerStatus();
            }, 1000);
        } else if (sttServerControlBtn.textContent.includes('Shutdown')) {
            setSTTServerButtonState('stopping');
            updateDebugInfo('[UI] Attempting to stop STT server...');
            try {
                const response = await fetch('/api/stop-rust-stt-server', { method: 'POST' });
                if (response.ok) {
                    updateDebugInfo('[UI] STT server stop command sent successfully');
                } else {
                    updateDebugInfo('[UI] STT server stop command failed');
                }
            } catch (error) {
                updateDebugInfo(`[UI] STT server stop error: ${error.message}`);
            }
            setTimeout(() => {
                pollSTTServerStatus();
            }, 1000);
        }
    };
}
window.addEventListener('DOMContentLoaded', attachSTTServerControlHandler);

// --- PATCH: Call updateSTTModelLock after polling server status and on page load ---
window.addEventListener('DOMContentLoaded', function() {
    pollSTTServerStatus();
    updateSTTModelLock('offline');
    setupCopyTranscriptButton();
    
    // Test DOM elements
    const liveTranscriptDiv = document.getElementById('liveTranscript');
    const liveTranscriptText = document.getElementById('liveTranscriptText');
});

// Patch pollSTTServerStatus to update model lock and re-attach control handler
async function pollSTTServerStatus() {
    try {
        const resp = await fetch('/api/rust-stt-server-status');
        const data = await resp.json();
        let status = data.status;
        updateSTTServerStatusUI(status, data.url);
        updateSTTModelLock(status);
        attachSTTServerControlHandler();
        // Initialize STT server log polling
        pollSTTServerLog();
    } catch (e) {
        updateSTTServerStatusUI('offline');
        updateSTTModelLock('offline');
        attachSTTServerControlHandler();
    }
}

// --- PATCH: Prevent click on disabled model button and enforce not-allowed cursor ---
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('#sttModelSelector input[type=radio]').forEach(radio => {
        radio.addEventListener('click', function(e) {
            if (this.disabled) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        // Always enforce not-allowed cursor if disabled
        radio.closest('.backend-option').addEventListener('mouseenter', function() {
            if (radio.disabled) {
                this.style.cursor = 'not-allowed';
            }
        });
        radio.closest('.backend-option').addEventListener('mouseleave', function() {
            this.style.cursor = radio.disabled ? 'not-allowed' : 'pointer';
        });
    });
});

// === Audio Recording Functionality ===
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isLiveTranscribing = false;
let liveTranscriptionStream = null;
let liveTranscriptionWebSocket = null;
let liveTranscriptionProcessor = null;
let liveTranscriptionAudioContext = null;

function setupAudioRecording() {
    const recordBtn = document.getElementById('recordBtn');
    const recordingStatus = document.getElementById('recordingStatus');
    const liveTranscribeBtn = document.getElementById('liveTranscribeBtn');
    const transcribeBtn = document.getElementById('transcribeBtn');
    const startLiveTranscribeBtn = document.getElementById('startLiveTranscribeBtn');
    
    if (recordBtn) {
        recordBtn.addEventListener('click', async function() {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        });
    }
    
    if (liveTranscribeBtn) {
        liveTranscribeBtn.addEventListener('click', function() {
            // Select live transcription mode
            selectLiveTranscriptionMode();
        });
    }
    
    if (startLiveTranscribeBtn) {
        startLiveTranscribeBtn.addEventListener('click', async function() {
            if (isLiveTranscribing) {
                stopLiveTranscription();
            } else {
                startLiveTranscription();
            }
        });
    }
}

function selectLiveTranscriptionMode() {
    // Update UI to show live transcription is selected
    const liveTranscribeBtn = document.getElementById('liveTranscribeBtn');
    const transcribeBtn = document.getElementById('transcribeBtn');
    const startLiveTranscribeBtn = document.getElementById('startLiveTranscribeBtn');
    const audioInputStatus = document.getElementById('audioInputStatus');
    const liveTranscriptDiv = document.getElementById('liveTranscript');
    const transcriptionResult = document.getElementById('transcriptionResult');
    
    if (liveTranscribeBtn) {
        liveTranscribeBtn.textContent = '🎙️ Live Transcribe';
        liveTranscribeBtn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
    }
    
    if (transcribeBtn) {
        transcribeBtn.style.display = 'none';
    }
    
    if (startLiveTranscribeBtn) {
        startLiveTranscribeBtn.style.display = 'inline-block';
    }
    
    if (audioInputStatus) {
        audioInputStatus.textContent = 'Live transcription mode selected. Click "Start Live Transcription" to begin.';
    }
    
    // Show live transcript section for live transcription mode
    if (liveTranscriptDiv) {
        liveTranscriptDiv.style.display = 'block';
    }
    
    // Hide transcription result section for live mode
    if (transcriptionResult) {
        transcriptionResult.style.display = 'none';
    }
    
    // Reset other buttons to default state
    const customFileBtn = document.getElementById('customFileBtn');
    const recordBtn = document.getElementById('recordBtn');
    
    if (customFileBtn) {
        customFileBtn.textContent = '📁 Choose File';
        customFileBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    if (recordBtn) {
        recordBtn.textContent = '🎤 Record Audio';
        recordBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    // Clear any existing file/recording
    const audioInput = document.getElementById('audioInput');
    const selectedFileName = document.getElementById('selectedFileName');
    const recordingStatus = document.getElementById('recordingStatus');
    
    if (audioInput) {
        audioInput.value = '';
    }
    if (selectedFileName) {
        selectedFileName.textContent = '';
    }
    if (recordingStatus) {
        recordingStatus.textContent = '';
    }
    
    // Hide audio preview
    const audioPreview = document.getElementById('audioPreview');
    if (audioPreview) {
        audioPreview.style.display = 'none';
    }
}

function resetAudioInputMode() {
    const liveTranscribeBtn = document.getElementById('liveTranscribeBtn');
    const transcribeBtn = document.getElementById('transcribeBtn');
    const startLiveTranscribeBtn = document.getElementById('startLiveTranscribeBtn');
    const audioInputStatus = document.getElementById('audioInputStatus');
    const liveTranscriptDiv = document.getElementById('liveTranscript');
    const transcriptionResult = document.getElementById('transcriptionResult');
    
    if (liveTranscribeBtn) {
        liveTranscribeBtn.textContent = '🎙️ Live Transcribe';
        liveTranscribeBtn.style.background = 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
    }
    
    if (transcribeBtn) {
        transcribeBtn.style.display = 'inline-block';
    }
    
    if (startLiveTranscribeBtn) {
        startLiveTranscribeBtn.style.display = 'none';
    }
    
    if (audioInputStatus) {
        audioInputStatus.textContent = 'No audio selected or recorded yet. Ready for upload, recording, or live transcription.';
    }
    
    // Hide live transcript section for file/recording modes
    if (liveTranscriptDiv) {
        liveTranscriptDiv.style.display = 'none';
    }
    
    // Show transcription result section for file/recording modes
    if (transcriptionResult) {
        transcriptionResult.style.display = 'block';
    }
}

async function startRecording() {
    try {
        if (typeof updateDebugInfo === 'function') {
            updateDebugInfo('[Audio Recording] Requesting microphone access...');
        }
        
        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Media devices not available. This may be due to:\n1. Page not served over HTTPS\n2. Browser permissions not granted\n3. Browser does not support getUserMedia');
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = function(event) {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = function() {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Create a file from the blob
            const audioFile = new File([audioBlob], 'recorded_audio.wav', { type: 'audio/wav' });
            
            // Set the file input
            const audioInput = document.getElementById('audioInput');
            if (audioInput) {
                // Create a new FileList-like object
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(audioFile);
                audioInput.files = dataTransfer.files;
                
                // Update the file name display
                const selectedFileName = document.getElementById('selectedFileName');
                if (selectedFileName) {
                    selectedFileName.textContent = 'recorded_audio.wav (Recorded)';
                }
                
                // Create audio preview
                createAudioPreview(audioUrl);
            } else {
                console.error('audioInput element not found!');
            }
            
            // Update UI
            const recordBtn = document.getElementById('recordBtn');
            const recordingStatus = document.getElementById('recordingStatus');
            const transcribeBtn = document.getElementById('transcribeBtn');
            if (recordBtn) {
                recordBtn.textContent = '🎤 Record Audio';
                recordBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }
            if (recordingStatus) {
                recordingStatus.textContent = 'Recording stopped';
                recordingStatus.style.color = '#4caf50';
            }
            // Re-enable transcribe button after recording
            if (transcribeBtn) {
                transcribeBtn.disabled = false;
                transcribeBtn.style.opacity = '1';
                transcribeBtn.style.cursor = 'pointer';
            }
            
            isRecording = false;
            
            // Log debug info
            if (typeof updateDebugInfo === 'function') {
                updateDebugInfo('[Audio Recording] Recording completed and saved');
            }
        };
        
        mediaRecorder.start();
        isRecording = true;
        
        // Reset audio input mode to show recording is active
        resetAudioInputMode();
        
        // Update UI
        const recordBtn = document.getElementById('recordBtn');
        const recordingStatus = document.getElementById('recordingStatus');
        const transcribeBtn = document.getElementById('transcribeBtn');
        if (recordBtn) {
            recordBtn.textContent = '⏹️ Stop Recording';
            recordBtn.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        }
        if (recordingStatus) {
            recordingStatus.textContent = 'Recording...';
            recordingStatus.style.color = '#f44336';
        }
        // Disable transcribe button during recording
        if (transcribeBtn) {
            transcribeBtn.disabled = true;
            transcribeBtn.style.opacity = '0.5';
            transcribeBtn.style.cursor = 'not-allowed';
        }
        
        // Log debug info
        if (typeof updateDebugInfo === 'function') {
            updateDebugInfo('[Audio Recording] Recording started');
        }
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        if (typeof updateDebugInfo === 'function') {
            updateDebugInfo(`[Audio Recording Error] ${error.message}`);
        }
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

async function startLiveTranscription() {
    try {
        console.log('[DEBUG] Starting live transcription...');
        if (typeof updateDebugInfo === 'function') {
            updateDebugInfo('[Live Transcription] Starting...');
        }

        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Media devices not available. This may be due to:\n1. Page not served over HTTPS\n2. Browser permissions not granted\n3. Browser does not support getUserMedia');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        liveTranscriptionStream = stream;

        // Use Socket.IO for live transcription
        const socket = io('/live-transcribe', {
            transports: ['websocket'],
            upgrade: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000
        });
        liveTranscriptionWebSocket = socket;

        // Remove the annoying global event listener and alerts
        // socket.onAny((event, ...args) => {
        //     console.log('[SOCKET.IO onAny]', event, args);
        //     window.alert('[SOCKET.IO onAny] ' + event + ' ' + JSON.stringify(args));
        // });

        socket.on('connect', () => {
            updateDebugInfo('[Live Transcription] Socket connected');
            
            // Test emit to verify connection
            socket.emit('test_message', {message: 'Hello from frontend'});
        });
        socket.on('status', (data) => {
            updateDebugInfo('[Live Transcription] ' + data.msg);
        });
        socket.on('test_response', (data) => {
            updateDebugInfo('[Live Transcription] Test response: ' + data.msg);
        });
        socket.on('partial_transcript', (data) => {
            // Always show transcript in debug info panel
            updateDebugInfo('[TRANSCRIPT] ' + data.text);
            
            // Only append real recognized words, not debug/test messages
            if (data.text && !data.text.startsWith('[debug]') && data.text.trim() !== '') {
                const liveTranscriptDiv = document.getElementById('liveTranscript');
                const liveTranscriptText = document.getElementById('liveTranscriptText');
                
                if (liveTranscriptDiv && liveTranscriptText) {
                    liveTranscriptDiv.style.display = 'block';
                    // Remove debug styling
                    liveTranscriptDiv.style.border = '1px solid #e0e0e0';
                    liveTranscriptDiv.style.background = '#f4f6fa';
                    
                    liveTranscriptText.textContent += data.text + ' ';
                    
                    // Force a reflow to ensure the text is visible
                    liveTranscriptDiv.offsetHeight;
                    
                    // Scroll to bottom of transcript
                    liveTranscriptText.scrollTop = liveTranscriptText.scrollHeight;
                }
            }
            updateDebugInfo('[Live Transcription] Partial: ' + data.text);
        });
        socket.on('final_transcript', (data) => {
            updateDebugInfo('[Live Transcription] Final: ' + data.text);
        });
        socket.on('connect_error', (err) => {
            updateDebugInfo('[Live Transcription Error] WebSocket connect error: ' + err.message);
        });
        socket.on('disconnect', () => {
            updateDebugInfo('[Live Transcription] Socket disconnected');
        });
        socket.on('reconnect', () => {
            updateDebugInfo('[Live Transcription] Socket reconnected');
        });
        socket.on('reconnect_attempt', (attemptNumber) => {
            updateDebugInfo(`[Live Transcription] Reconnection attempt ${attemptNumber}`);
        });
        socket.on('reconnect_error', (error) => {
            updateDebugInfo(`[Live Transcription] Reconnection error: ${error.message}`);
        });

        // Start sending audio data
        const audioContext = new AudioContext({ sampleRate: 24000 });
        const source = audioContext.createMediaStreamSource(stream);
        const BLOCK_SIZE = 1920; // 80ms at 24kHz
        let buffer = [];
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = function(e) {
            if (socket.connected) {
                const audioData = e.inputBuffer.getChannelData(0);
                for (let i = 0; i < audioData.length; i++) {
                    buffer.push(audioData[i]);
                    if (buffer.length === BLOCK_SIZE) {
                        const float32 = new Float32Array(buffer);
                        const bytes = new Uint8Array(float32.buffer);
                        const chunk = btoa(String.fromCharCode.apply(null, bytes));
                        socket.emit('audio_chunk', { chunk });
                        buffer = [];
                    }
                }
            }
        };
        source.connect(processor);
        processor.connect(audioContext.destination);
        liveTranscriptionProcessor = processor;
        liveTranscriptionAudioContext = audioContext;

        // Update UI
        const startLiveTranscribeBtn = document.getElementById('startLiveTranscribeBtn');
        if (startLiveTranscribeBtn) {
            startLiveTranscribeBtn.textContent = '⏹️ Stop Live Transcription';
            startLiveTranscribeBtn.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        }
        // Reveal the live transcript box immediately when live transcription starts
        const liveTranscriptDiv = document.getElementById('liveTranscript');
        const liveTranscriptText = document.getElementById('liveTranscriptText');
        if (liveTranscriptDiv && liveTranscriptText) {
            liveTranscriptDiv.style.display = 'block';
            // If there's existing text, add a line break to separate sessions
            if (liveTranscriptText.textContent.trim() !== '') {
                liveTranscriptText.textContent += '\n\n--- New Session ---\n\n';
            } else {
                liveTranscriptText.textContent = '';
            }
            // Add a test message to verify the transcript box is working
            liveTranscriptText.textContent += '[System] Live transcription ready - waiting for audio input...\n';
        }

        isLiveTranscribing = true;

        // Add periodic connection check for debugging
        const connectionCheckInterval = setInterval(() => {
            if (isLiveTranscribing) {
                // Send a ping to keep the connection alive
                if (socket.connected) {
                    socket.emit('ping', {timestamp: Date.now()});
                }
            } else {
                clearInterval(connectionCheckInterval);
            }
        }, 2000); // Check every 2 seconds

        if (typeof updateDebugInfo === 'function') {
            updateDebugInfo('[Live Transcription] Started successfully');
        }

    } catch (error) {
        console.error('Error starting live transcription:', error);
        if (typeof updateDebugInfo === 'function') {
            updateDebugInfo(`[Live Transcription Error] ${error.message}`);
        }
    }
}

function stopLiveTranscription() {
    if (liveTranscriptionWebSocket) {
        liveTranscriptionWebSocket.emit && liveTranscriptionWebSocket.emit('end_stream');
        liveTranscriptionWebSocket.disconnect && liveTranscriptionWebSocket.disconnect();
        liveTranscriptionWebSocket = null;
    }
    if (liveTranscriptionProcessor && liveTranscriptionAudioContext) {
        liveTranscriptionProcessor.disconnect();
        liveTranscriptionAudioContext.close();
        liveTranscriptionProcessor = null;
        liveTranscriptionAudioContext = null;
    }
    if (liveTranscriptionStream) {
        liveTranscriptionStream.getTracks().forEach(track => track.stop());
        liveTranscriptionStream = null;
    }
    
    // Update UI - only change the start button, don't reset the mode
    const startLiveTranscribeBtn = document.getElementById('startLiveTranscribeBtn');
    if (startLiveTranscribeBtn) {
        startLiveTranscribeBtn.textContent = 'Start Live Transcription';
        startLiveTranscribeBtn.style.background = 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
    }
    
    // Don't reset audio input mode - keep live transcribe selected and transcript visible
    // resetAudioInputMode();
    
    // Keep the live transcript visible with the final transcript
    // const liveTranscriptDiv = document.getElementById('liveTranscript');
    // if (liveTranscriptDiv) {
    //     liveTranscriptDiv.style.display = 'none';
    // }
    isLiveTranscribing = false;
    if (typeof updateDebugInfo === 'function') {
        updateDebugInfo('[Live Transcription] Stopped');
    }
}

// Add copy transcript functionality
function setupCopyTranscriptButton() {
    const copyBtn = document.getElementById('copyTranscriptBtn');
    const clearBtn = document.getElementById('clearTranscriptBtn');
    const saveTranscriptBtn = document.getElementById('saveTranscriptBtn');
    const clearDebugBtn = document.getElementById('clearDebugBtn');
    const copyDebugBtn = document.getElementById('copyDebugBtn');
    const saveDebugBtn = document.getElementById('saveDebugBtn');
    
    // Transcription result buttons
    const copyTranscriptionBtn = document.getElementById('copyTranscriptionBtn');
    const clearTranscriptionBtn = document.getElementById('clearTranscriptionBtn');
    const saveTranscriptionBtn = document.getElementById('saveTranscriptionBtn');
    
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            const transcriptText = document.getElementById('liveTranscriptText');
            if (transcriptText && transcriptText.textContent.trim() !== '') {
                navigator.clipboard.writeText(transcriptText.textContent).then(function() {
                    // Temporarily change button text to show success
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.background = '#4caf50';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = '#667eea';
                    }, 2000);
                }).catch(function(err) {
                    console.error('Failed to copy transcript:', err);
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = transcriptText.textContent;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.background = '#4caf50';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = '#667eea';
                    }, 2000);
                });
            }
        });
    }
    
    if (copyTranscriptionBtn) {
        copyTranscriptionBtn.addEventListener('click', function() {
            const transcriptionText = document.getElementById('transcriptionResultText');
            if (transcriptionText && transcriptionText.textContent.trim() !== '') {
                navigator.clipboard.writeText(transcriptionText.textContent).then(function() {
                    // Temporarily change button text to show success
                    const originalText = copyTranscriptionBtn.textContent;
                    copyTranscriptionBtn.textContent = 'Copied!';
                    copyTranscriptionBtn.style.background = '#4caf50';
                    setTimeout(() => {
                        copyTranscriptionBtn.textContent = originalText;
                        copyTranscriptionBtn.style.background = '#667eea';
                    }, 2000);
                }).catch(function(err) {
                    console.error('Failed to copy transcription:', err);
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = transcriptionText.textContent;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    const originalText = copyTranscriptionBtn.textContent;
                    copyTranscriptionBtn.textContent = 'Copied!';
                    copyTranscriptionBtn.style.background = '#4caf50';
                    setTimeout(() => {
                        copyTranscriptionBtn.textContent = originalText;
                        copyTranscriptionBtn.style.background = '#667eea';
                    }, 2000);
                });
            }
        });
    }
    
    if (saveTranscriptBtn) {
        saveTranscriptBtn.addEventListener('click', function() {
            const transcriptText = document.getElementById('liveTranscriptText');
            if (transcriptText && transcriptText.textContent.trim() !== '') {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `live_transcript_${timestamp}.txt`;
                const blob = new Blob([transcriptText.textContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // Temporarily change button text to show success
                const originalText = saveTranscriptBtn.textContent;
                saveTranscriptBtn.textContent = 'Saved!';
                saveTranscriptBtn.style.background = '#4caf50';
                setTimeout(() => {
                    saveTranscriptBtn.textContent = originalText;
                    saveTranscriptBtn.style.background = '#4caf50';
                }, 2000);
            }
        });
    }
    
    if (saveTranscriptionBtn) {
        saveTranscriptionBtn.addEventListener('click', function() {
            const transcriptionText = document.getElementById('transcriptionResultText');
            if (transcriptionText && transcriptionText.textContent.trim() !== '') {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `transcription_result_${timestamp}.txt`;
                const blob = new Blob([transcriptionText.textContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // Temporarily change button text to show success
                const originalText = saveTranscriptionBtn.textContent;
                saveTranscriptionBtn.textContent = 'Saved!';
                saveTranscriptionBtn.style.background = '#4caf50';
                setTimeout(() => {
                    saveTranscriptionBtn.textContent = originalText;
                    saveTranscriptionBtn.style.background = '#4caf50';
                }, 2000);
            }
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            const transcriptText = document.getElementById('liveTranscriptText');
            if (transcriptText) {
                transcriptText.textContent = '';
                // Temporarily change button text to show success
                const originalText = clearBtn.textContent;
                clearBtn.textContent = 'Cleared!';
                clearBtn.style.background = '#4caf50';
                setTimeout(() => {
                    clearBtn.textContent = originalText;
                    clearBtn.style.background = '#f44336';
                }, 2000);
            }
        });
    }
    
    if (clearTranscriptionBtn) {
        clearTranscriptionBtn.addEventListener('click', function() {
            const transcriptionText = document.getElementById('transcriptionResultText');
            if (transcriptionText) {
                transcriptionText.textContent = '';
                // Temporarily change button text to show success
                const originalText = clearTranscriptionBtn.textContent;
                clearTranscriptionBtn.textContent = 'Cleared!';
                clearTranscriptionBtn.style.background = '#4caf50';
                setTimeout(() => {
                    clearTranscriptionBtn.textContent = originalText;
                    clearTranscriptionBtn.style.background = '#f44336';
                }, 2000);
            }
        });
    }
    
    if (clearDebugBtn) {
        clearDebugBtn.addEventListener('click', function() {
            const debugText = document.getElementById('debugText');
            if (debugText) {
                debugText.textContent = '';
                // Temporarily change button text to show success
                const originalText = clearDebugBtn.textContent;
                clearDebugBtn.textContent = 'Cleared!';
                clearDebugBtn.style.background = '#4caf50';
                setTimeout(() => {
                    clearDebugBtn.textContent = originalText;
                    clearDebugBtn.style.background = '#f44336';
                }, 2000);
            }
        });
    }
    
    if (copyDebugBtn) {
        copyDebugBtn.addEventListener('click', function() {
            const debugText = document.getElementById('debugText');
            if (debugText && debugText.textContent.trim() !== '') {
                navigator.clipboard.writeText(debugText.textContent).then(function() {
                    // Temporarily change button text to show success
                    const originalText = copyDebugBtn.textContent;
                    copyDebugBtn.textContent = 'Copied!';
                    copyDebugBtn.style.background = '#4caf50';
                    setTimeout(() => {
                        copyDebugBtn.textContent = originalText;
                        copyDebugBtn.style.background = '#667eea';
                    }, 2000);
                }).catch(function(err) {
                    console.error('Failed to copy debug info:', err);
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = debugText.textContent;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    const originalText = copyDebugBtn.textContent;
                    copyDebugBtn.textContent = 'Copied!';
                    copyDebugBtn.style.background = '#4caf50';
                    setTimeout(() => {
                        copyDebugBtn.textContent = originalText;
                        copyDebugBtn.style.background = '#667eea';
                    }, 2000);
                });
            }
        });
    }
    
    if (saveDebugBtn) {
        saveDebugBtn.addEventListener('click', function() {
            const debugText = document.getElementById('debugText');
            if (debugText && debugText.textContent.trim() !== '') {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `debug_log_${timestamp}.txt`;
                const blob = new Blob([debugText.textContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // Temporarily change button text to show success
                const originalText = saveDebugBtn.textContent;
                saveDebugBtn.textContent = 'Saved!';
                saveDebugBtn.style.background = '#4caf50';
                setTimeout(() => {
                    saveDebugBtn.textContent = originalText;
                    saveDebugBtn.style.background = '#4caf50';
                }, 2000);
            }
        });
    }
}

function createAudioPreview(audioUrl) {
    // Remove existing audio preview
    const existingPreview = document.getElementById('audioPreview');
    if (existingPreview) {
        existingPreview.innerHTML = '';
        existingPreview.style.display = 'none';
    }
    // Create audio element
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.style.width = '100%';
    audio.style.maxWidth = '100%';
    audio.src = audioUrl;
    // Add label
    const label = document.createElement('div');
    label.textContent = 'Audio Preview:';
    label.style.fontWeight = 'bold';
    label.style.marginBottom = '5px';
    label.style.color = '#333';
    // Insert
    if (existingPreview) {
        existingPreview.appendChild(label);
        existingPreview.appendChild(audio);
        existingPreview.style.display = '';
    }
}

// Handle file input change for uploaded files
function setupFileInputPreview() {
    const audioInput = document.getElementById('audioInput');
    if (audioInput) {
        audioInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const audioUrl = URL.createObjectURL(file);
                createAudioPreview(audioUrl);
                
                // Reset audio input mode to show file is selected
                resetAudioInputMode();
            }
        });
    }
}

function saveTranscript(transcript, timestamps) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `transcript_${timestamp}.txt`;
    
    let content = `Transcript: ${transcript}\n\n`;
    
    if (timestamps && timestamps.length > 0) {
        content += `Word Timestamps:\n`;
        timestamps.forEach(timestamp => {
            content += `${timestamp}\n`;
        });
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if (typeof updateDebugInfo === 'function') {
        updateDebugInfo(`[STT] Transcript saved as ${filename}`);
    }
}

// Server control spinner functions
function addServerSpinner(button) {
    const originalText = button.textContent;
    button.textContent = '⏳ Starting...';
    button.disabled = true;
    button.style.opacity = '0.7';
    return originalText;
}

function removeServerSpinner(button, originalText) {
    button.textContent = originalText;
    button.disabled = false;
    button.style.opacity = '1';
}

// Initialize audio recording when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupAudioRecording();
    setupFileInputPreview();
});

if (sttForm) {
    sttForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        // Only clear result when a new transcription is started
        const transcriptionResult = document.getElementById('transcriptionResult');
        const transcriptionResultText = document.getElementById('transcriptionResultText');
        if (transcriptionResult) transcriptionResult.style.display = 'none';
        if (transcriptionResultText) transcriptionResultText.textContent = '';
        
        if (!audioInput.files || audioInput.files.length === 0) {
            if (transcriptionResultText) transcriptionResultText.textContent = 'Please select an audio file.';
            if (transcriptionResult) transcriptionResult.style.display = 'block';
            return;
        }
        const file = audioInput.files[0];
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('model', selectedSTTModel);
        formData.append('backend', selectedSTTBackend);
        // Log debug info immediately when transcription starts, including model and backend
        if (typeof updateDebugInfo === 'function') {
            updateDebugInfo(`[STT Debug] Transcription started for file: ${file.name} using model: ${selectedSTTModel}, backend: ${selectedSTTBackend}`);
        }
        // Show loading spinner and timer (like TTS)
        loading.style.display = 'block';
        // Change loading text for STT
        const loadingText = loading.querySelector('p');
        const prevLoadingText = loadingText.textContent;
        loadingText.textContent = 'Transcribing Audio...';
        const timerElem = document.getElementById('timer');
        timerStart = Date.now();
        timerElem.textContent = 'Elapsed: 0.0s';
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const elapsed = (Date.now() - timerStart) / 1000;
            timerElem.textContent = `Elapsed: ${elapsed.toFixed(1)}s`;
        }, 100);
        try {
            const response = await fetch('/api/speech-to-text', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            loading.style.display = 'none';
            // Restore loading text for TTS
            loadingText.textContent = prevLoadingText;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            timerElem.textContent = 'Elapsed: 0.0s';
            if (response.ok && data.transcript) {
                let resultText = data.transcript;
                
                // Add timestamps if available and checkbox is checked
                const showTimestamps = document.getElementById('showTimestamps');
                if (data.timestamps && data.timestamps.length > 0 && showTimestamps && showTimestamps.checked) {
                    resultText += '\n\nWord Timestamps:\n';
                    resultText += data.timestamps.join('\n');
                }
                
                if (transcriptionResultText) {
                    transcriptionResultText.textContent = resultText;
                }
                if (transcriptionResult) {
                    transcriptionResult.style.display = 'block';
                }
                
                // Improved debug info parsing and logging
                if (data.debug && typeof updateDebugInfo === 'function') {
                    const lines = data.debug.split(/\r?\n/).filter(Boolean);
                    let lastMimi = false, lastMoshi = false;
                    lines.forEach((line, idx) => {
                        const cleanLine = line.replace(/\u001b\[[0-9;]*m/g, '');
                        if (cleanLine.includes('loading mimi')) {
                            lastMimi = true;
                        } else if (cleanLine.includes('mimi loaded')) {
                            if (lastMimi) {
                                updateDebugInfo('[STT Debug] mimi loaded');
                                lastMimi = false;
                            } else {
                                updateDebugInfo('[STT Debug] ' + cleanLine);
                            }
                        } else if (cleanLine.includes('loading moshi')) {
                            lastMoshi = true;
                        } else if (cleanLine.includes('moshi loaded')) {
                            if (lastMoshi) {
                                updateDebugInfo('[STT Debug] moshi loaded');
                                lastMoshi = false;
                            } else {
                                updateDebugInfo('[STT Debug] ' + cleanLine);
                            }
                        } else if (!cleanLine.includes('loading mimi') && !cleanLine.includes('loading moshi')) {
                            updateDebugInfo('[STT Debug] ' + cleanLine);
                        }
                    });
                    // Add transcript to debug info
                    updateDebugInfo(`[STT Debug] Text transcribed successfully: ${data.transcript}`);
                }
            } else {
                if (transcriptionResultText) {
                    transcriptionResultText.textContent = `Error: ${data.error || 'Unknown error.'}`;
                }
                if (transcriptionResult) {
                    transcriptionResult.style.display = 'block';
                }
                if (data.debug && typeof updateDebugInfo === 'function') {
                    const lines = data.debug.split(/\r?\n/).filter(Boolean);
                    lines.forEach(line => {
                        updateDebugInfo('[STT Debug Error] ' + line);
                    });
                }
            }
        } catch (err) {
            loading.style.display = 'none';
            // Restore loading text for TTS
            loadingText.textContent = prevLoadingText;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            timerElem.textContent = 'Elapsed: 0.0s';
            if (transcriptionResultText) {
                transcriptionResultText.textContent = `Error: ${err.message}`;
            }
            if (transcriptionResult) {
                transcriptionResult.style.display = 'block';
            }
        }
    });
}

async function pollRustServerLog() {
    try {
        const resp = await fetch('/api/rust-tts-server-log');
        const data = await resp.json();
        if (data.log && data.log.length > 0) {
            rustServerLogDiv.innerHTML = data.log.map(line => `<div style="margin: 2px 0; font-family: monospace; font-size: 11px;">${line.replace(/\[Rust TTS Server\] ?/, '')}</div>`).join('');
            // Only show if the log box is visible
            if (document.getElementById('rustServerLogBox') && document.getElementById('rustServerLogBox').style.display !== 'none') {
                rustServerLogDiv.style.display = 'block';
            } else {
                rustServerLogDiv.style.display = 'none';
            }
            rustServerLogDiv.style.maxHeight = '120px';
            rustServerLogDiv.style.overflowY = 'auto';
            rustServerLogDiv.style.background = '#f8f9fa';
            rustServerLogDiv.style.border = '1px solid #e0e0e0';
            rustServerLogDiv.style.borderRadius = '4px';
            rustServerLogDiv.style.padding = '8px';
        } else {
            rustServerLogDiv.style.display = 'none';
            rustServerLogDiv.innerHTML = '';
        }
    } catch (e) {
        rustServerLogDiv.style.display = 'none';
        rustServerLogDiv.innerHTML = '';
    }
}

function showRustServerLog(show) {
    if (show) {
        pollRustServerLog();
        if (!rustServerLogPoller) {
            rustServerLogPoller = setInterval(pollRustServerLog, 5000);
        }
    } else {
        if (rustServerLogPoller) {
            clearInterval(rustServerLogPoller);
            rustServerLogPoller = null;
        }
        rustServerLogDiv.style.display = 'none';
        rustServerLogDiv.innerHTML = '';
    }
}

// === TTS Server Management Functions (based on working STT pattern) ===
// Track TTS server status for button enable/disable
let ttsServerIsOnline = false;

function updateTTSServerStatusUI(status, url) {
    if (!rustServerStatusText) return;
    let statusText = status.charAt(0).toUpperCase() + status.slice(1);
    if (status === 'online' && url) {
        statusText += ` (${url})`;
    }
    rustServerStatusText.textContent = statusText;
    rustServerStatusText.className = status;
    setTTSServerButtonState(status);
    if (status === 'error') {
        fetch('/api/rust-tts-server-error').then(r => r.json()).then(data => {
            rustServerErrorDiv.textContent = 'TTS server failed to start: ' + (data.error || 'Unknown error');
            rustServerErrorDiv.style.display = '';
        });
    } else {
        rustServerErrorDiv.style.display = 'none';
        rustServerErrorDiv.textContent = '';
    }
    ttsServerIsOnline = (status === 'online');
    if (selectedBackend === 'rust') {
        generateBtn.disabled = !ttsServerIsOnline;
        if (!ttsServerIsOnline) {
            ttsServerMsg.textContent = 'Please start the Rust server before generating speech.';
        } else {
            ttsServerMsg.textContent = '';
        }
    }
}

let lastTTSServerStatus = null; // Track last known TTS server status

async function pollTTSServerStatus() {
    try {
        const resp = await fetch('/api/rust-tts-server-status');
        const data = await resp.json();
        let status = data.status;
        console.log('[TTS DEBUG] polled status:', status, 'url:', data.url); // Debug log
        lastTTSServerStatus = status; // Update last known status
        updateTTSServerStatusUI(status, data.url);
        // Initialize TTS server log polling
        pollTTSServerLog();
    } catch (e) {
        if (lastTTSServerStatus === 'starting') {
            // Optionally, show a subtle warning (e.g., network issue)
            // Keep UI in 'Starting...' state
            return;
        } else {
            updateTTSServerStatusUI('offline');
            lastTTSServerStatus = 'offline';
        }
    }
}

let ttsServerStatusPoller = null;

function showTTSServerStatusRow(show) {
    if (rustServerStatusRow) {
        rustServerStatusRow.style.display = show ? 'flex' : 'none';
    }
    if (show) {
        pollTTSServerStatus();
        if (!ttsServerStatusPoller) {
            ttsServerStatusPoller = setInterval(pollTTSServerStatus, 5000);
        }
    } else {
        if (ttsServerStatusPoller) {
            clearInterval(ttsServerStatusPoller);
            ttsServerStatusPoller = null;
        }
        rustServerErrorDiv.style.display = 'none';
        rustServerErrorDiv.textContent = '';
        lastTTSServerStatus = null;
    }
}

function setTTSServerButtonState(state) {
    const spinner = document.getElementById('rustServerSpinner');
    const startupLogBox = document.getElementById('rustServerLogBox');
    if (!rustServerControlBtn) return;
    if (spinner) spinner.style.display = 'none';
    const normalized = (state || '').toLowerCase().trim();
    if (startupLogBox) {
        if (normalized === 'starting') {
            startupLogBox.style.display = 'block';
        } else {
            startupLogBox.style.display = 'none';
        }
    }
    if (normalized === 'starting') {
        rustServerControlBtn.disabled = true;
        rustServerControlBtn.textContent = '⏳ Starting...';
        if (spinner) spinner.style.display = 'inline-block';
        showTTSServerLog(true);
    } else if (normalized === 'stopping') {
        rustServerControlBtn.disabled = true;
        rustServerControlBtn.textContent = '⏻ Stopping...';
        if (spinner) spinner.style.display = 'inline-block';
        showTTSServerLog(true);
    } else if (normalized === 'online') {
        rustServerControlBtn.disabled = false;
        rustServerControlBtn.textContent = 'Shutdown TTS Server';
        if (spinner) spinner.style.display = 'none';
        showTTSServerLog(false);
    } else {
        // offline or any other state
        rustServerControlBtn.disabled = false;
        rustServerControlBtn.textContent = 'Start TTS Server';
        if (spinner) spinner.style.display = 'none';
        showTTSServerLog(false);
    }
}

function attachTTSServerControlHandler() {
    // This function is no longer needed as we use the addEventListener handler
    // The button state is managed by setTTSServerButtonState and polling
}

async function pollTTSServerLog() {
    try {
        const resp = await fetch('/api/rust-tts-server-log');
        const data = await resp.json();
        if (data.log && data.log.length > 0) {
            rustServerLogDiv.innerHTML = data.log.map(line => `<div style="margin: 2px 0; font-family: monospace; font-size: 11px;">${line.replace(/\[Rust TTS Server\] ?/, '')}</div>`).join('');
            if (document.getElementById('rustServerLogBox') && document.getElementById('rustServerLogBox').style.display !== 'none') {
                rustServerLogDiv.style.display = 'block';
            } else {
                rustServerLogDiv.style.display = 'none';
            }
            rustServerLogDiv.style.maxHeight = '120px';
            rustServerLogDiv.style.overflowY = 'auto';
            rustServerLogDiv.style.background = '#f8f9fa';
            rustServerLogDiv.style.border = '1px solid #e0e0e0';
            rustServerLogDiv.style.borderRadius = '4px';
            rustServerLogDiv.style.padding = '8px';
        } else {
            rustServerLogDiv.style.display = 'none';
            rustServerLogDiv.innerHTML = '';
        }
    } catch (e) {
        rustServerLogDiv.style.display = 'none';
        rustServerLogDiv.innerHTML = '';
    }
}

function showTTSServerLog(show) {
    if (show) {
        pollTTSServerLog();
    } else {
        rustServerLogDiv.style.display = 'none';
        rustServerLogDiv.innerHTML = '';
    }
}

// Add a message element for the generate button if not present
let ttsServerMsg = document.getElementById('ttsServerMsg');
if (!ttsServerMsg) {
    ttsServerMsg = document.createElement('div');
    ttsServerMsg.id = 'ttsServerMsg';
    ttsServerMsg.style.fontSize = '13px';
    ttsServerMsg.style.color = '#b71c1c';
    ttsServerMsg.style.marginTop = '8px';
    ttsServerMsg.style.textAlign = 'center';
    generateBtn.parentNode.insertBefore(ttsServerMsg, generateBtn.nextSibling);
}