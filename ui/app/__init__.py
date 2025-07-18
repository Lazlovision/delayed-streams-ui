import os
from flask_socketio import SocketIO
from flask import Flask
from flask_cors import CORS
from .config import Config
import threading
import queue

socketio = SocketIO()

def process_event_queue(app):
    """Background task to process events from worker threads"""
    from .live_transcribe import event_queue
    
    while True:
        try:
            # Get event from queue (blocking)
            event = event_queue.get(timeout=1)
            
            # Emit the event to the frontend using Flask app context
            if event['type'] == 'partial_transcript':
                with app.app_context():
                    socketio.emit('partial_transcript', event['data'], namespace=event['namespace'])
            else:
                print(f"Unknown event type: {event['type']}")
                
        except queue.Empty:
            # Queue timeout - this is normal, don't log it
            pass
        except Exception as e:
            print(f"Queue processor error: {e}")

def create_app():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    app = Flask(
        __name__,
        template_folder=os.path.join(project_root, 'templates'),
        static_folder=os.path.join(project_root, 'static')
    )
    app.config.from_object(Config)
    CORS(app)
    from .routes import init_app
    init_app(app)
    from .live_transcribe import LiveTranscribeNamespace
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')
    socketio.on_namespace(LiveTranscribeNamespace('/live-transcribe'))
    
    # Start background task to process event queue
    queue_thread = threading.Thread(target=process_event_queue, args=(app,), daemon=True)
    queue_thread.start()
    
    return app 