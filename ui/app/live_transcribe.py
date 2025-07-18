# Required dependencies: flask, flask-socketio, websockets, msgpack, numpy
import asyncio
import base64
import json
import threading
import time
import numpy as np
import msgpack
import websockets
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import queue
from flask import request
from flask_socketio import Namespace, emit
from app import socketio

RUST_WS_URL = 'ws://127.0.0.1:8080/api/asr-streaming?auth_id=public_token'
RUST_WS_API_KEY = 'public_token'
SAMPLE_RATE = 24000
BLOCK_SIZE = 1920  # 80ms blocks

# Global queue for sending events from worker threads to main thread
event_queue = queue.Queue()

class LiveTranscribeNamespace(Namespace):
    def __init__(self, namespace):
        super().__init__(namespace)
        self.client_sessions = {}

    def on_connect(self):
        print(f"Client connected to live transcribe namespace")
        emit('status', {'msg': 'Connected to live transcribe'})

    def on_test_message(self, data):
        print(f"Received test message from frontend: {data}")
        emit('test_response', {'msg': 'Test message received by backend'})

    def on_ping(self, data):
        emit('pong', {'timestamp': data.get('timestamp', 0)})

    def on_disconnect(self):
        sid = self._get_sid()
        session = self.client_sessions.pop(sid, None)
        if session and 'thread' in session:
            session['stop'] = True
            # The thread will clean up

    def on_audio_chunk(self, data):
        sid = self._get_sid()
        # Expect base64-encoded Float32 PCM from frontend
        chunk = base64.b64decode(data['chunk'])
        # Convert bytes to float32 numpy array
        audio = np.frombuffer(chunk, dtype=np.float32)
        session = self.client_sessions.get(sid)
        if not session:
            session = {'stop': False, 'queue': None, 'loop': None}
            self.client_sessions[sid] = session
            t = threading.Thread(target=self._run_streaming, args=(sid, session), daemon=True)
            session['thread'] = t
            t.start()
        # Wait for the queue and loop to be created in the worker thread
        while session['queue'] is None or session['loop'] is None:
            time.sleep(0.001)
        # Put chunk in queue using the correct event loop
        asyncio.run_coroutine_threadsafe(session['queue'].put(audio), session['loop'])

    def on_end_stream(self):
        sid = self._get_sid()
        session = self.client_sessions.get(sid)
        if session:
            session['stop'] = True

    def _get_sid(self):
        return request.sid

    def _run_streaming(self, sid, session):
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            session['queue'] = asyncio.Queue()
            session['loop'] = loop  # Store the loop in the session
            loop.run_until_complete(self._stream_to_rust(sid, session))
        except Exception as e:
            print(f"Exception in _run_streaming for sid {sid}: {str(e)}")

    async def _stream_to_rust(self, sid, session):
        try:
            print(f"Connecting to Rust server for sid {sid}")
            async with websockets.connect(RUST_WS_URL) as ws:
                print(f"Connected to Rust server for sid {sid}")
                
                async def send_audio():
                    while not session['stop']:
                        audio = await session['queue'].get()
                        chunk = {"type": "Audio", "pcm": audio.tolist()}
                        msg = msgpack.packb(chunk, use_bin_type=True, use_single_float=True)
                        await ws.send(msg)
                        
                async def recv_transcript():
                    async for msg in ws:
                        try:
                            data = msgpack.unpackb(msg, raw=False)
                            if data.get('type') == 'Word':
                                # Queue the event for main thread to emit
                                event_queue.put({
                                    'type': 'partial_transcript',
                                    'data': {'text': data.get('text', '')},
                                    'namespace': '/live-transcribe',
                                    'sid': sid
                                })
                            elif data.get('type') == 'Step':
                                pass
                            else:
                                print(f"Unhandled type: {data.get('type')}")
                        except Exception as e:
                            print(f"MessagePack decode error: {str(e)}")
                            
                await asyncio.gather(send_audio(), recv_transcript())
        except Exception as e:
            print(f"Exception in _stream_to_rust: {str(e)}")
            event_queue.put({
                'type': 'partial_transcript',
                'data': {'text': f'[error] {str(e)}'},
                'namespace': '/live-transcribe',
                'sid': sid
            }) 