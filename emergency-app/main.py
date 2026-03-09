from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import json
import uuid

app = FastAPI(title="Emergency Response System")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# In-memory data store for the prototype
active_trips = {}
connections = {
    "police": [],
    "hospital": [],
    "ambulance": []
}

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket, role: str):
        await websocket.accept()
        if role in connections:
            connections[role].append(websocket)
            self.active_connections.append((websocket, role))

    def disconnect(self, websocket: WebSocket, role: str):
        if role in connections and websocket in connections[role]:
            connections[role].remove(websocket)
        if (websocket, role) in self.active_connections:
            self.active_connections.remove((websocket, role))

    async def broadcast_to_role(self, message: str, role: str):
        for connection in connections.get(role, []):
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws/{role}")
async def websocket_endpoint(websocket: WebSocket, role: str):
    await manager.connect(websocket, role)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # If an ambulance sends location data, forward it to police and hospital
            if role == "ambulance" and payload.get("type") == "location_update":
                trip_id = payload.get("trip_id", "unknown")
                lat = payload.get("lat")
                lng = payload.get("lng")
                
                # Active trip update
                active_trips[trip_id] = {"lat": lat, "lng": lng}
                
                broadcast_msg = json.dumps({
                    "type": "ambulance_location",
                    "trip_id": trip_id,
                    "lat": lat,
                    "lng": lng
                })
                await manager.broadcast_to_role(broadcast_msg, "police")
                await manager.broadcast_to_role(broadcast_msg, "hospital")
                
            elif role == "ambulance" and payload.get("type") == "start_trip":
                trip_id = str(uuid.uuid4())
                await websocket.send_text(json.dumps({"type": "trip_started", "trip_id": trip_id}))
                
                broadcast_msg = json.dumps({
                    "type": "new_emergency",
                    "trip_id": trip_id,
                    "message": "A new emergency trip has started."
                })
                await manager.broadcast_to_role(broadcast_msg, "police")
                await manager.broadcast_to_role(broadcast_msg, "hospital")

    except WebSocketDisconnect:
        manager.disconnect(websocket, role)
