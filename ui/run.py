from app import create_app, socketio

app = create_app()

if __name__ == "__main__":
    from app.config import Config
    socketio.run(app, debug=Config.DEBUG_MODE, host="0.0.0.0", port=int(Config.UI_SERVER_PORT))
