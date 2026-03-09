// Initialize maps
let maps = {};
let markers = {
    ambulance: null,
    hospital: {}, // Incoming ambulances for hospital view
    realEntities: [] // To store fetched hospitals, police, traffic signals
};
let ws = null;

// Hospital Coordinates (Mock)
const HOSPITALS = {
    h1: { lat: 40.730610, lng: -73.935242, name: "City General Hospital" },
    h2: { lat: 40.712776, lng: -74.005974, name: "Mercy Medical Center" }
};

// Start location for ambulance (Default to NYC, updated by Geolocation)
let currentAmbulanceLoc = { lat: 40.7580, lng: -73.9855 };

// Function to get user's real location
function updateToRealLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            currentAmbulanceLoc = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            
            // If the ambulance map exists, update its view and marker
            if (maps['ambulance-view']) {
                maps['ambulance-view'].setView([currentAmbulanceLoc.lat, currentAmbulanceLoc.lng], 14);
                if (markers.ambulance) {
                    markers.ambulance.setLatLng(currentAmbulanceLoc);
                }
            }
            
            // Fetch real-world data around this new location
            fetchRealWorldEntities(currentAmbulanceLoc.lat, currentAmbulanceLoc.lng, 'ambulance-view');
            fetchRealWorldEntities(currentAmbulanceLoc.lat, currentAmbulanceLoc.lng, 'hospital-view');
            fetchRealWorldEntities(currentAmbulanceLoc.lat, currentAmbulanceLoc.lng, 'police-view');
            
        }, (error) => {
            console.warn("Geolocation denied or error:", error.message);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navItems = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.dashboard-view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update active nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show target view
            const targetId = item.getAttribute('data-target');
            views.forEach(view => {
                view.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');

            // Initialize map if it hasn't been yet because Leaflet needs visible containers
            setTimeout(() => {
                initMapForView(targetId);
            }, 100);
            
            // Connect to websocket with appropriate role
            setupWebSocket(targetId.split('-')[0]);
        });
    });

    // Init Ambulance Map (Default View)
    initMapForView('ambulance-view');
    updateToRealLocation(); // Request real location on load
    setupWebSocket('ambulance');

    // Ambulance Start Trip Logic
    document.getElementById('start-trip-btn').addEventListener('click', () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            alert("No connection to server.");
            return;
        }

        const btn = document.getElementById('start-trip-btn');
        btn.innerHTML = "Trip In Progress...";
        btn.disabled = true;
        btn.style.opacity = 0.7;

        document.getElementById('ambulance-status-dot').classList.add('active');
        document.getElementById('ambulance-status-text').innerText = "Broadcasting Location...";

        // Send start trip signal
        ws.send(JSON.stringify({ type: "start_trip" }));

        // Start broadcasting location
        setInterval(() => {
            // Simulate moving roughly towards hospital h1
            currentAmbulanceLoc.lat -= 0.0010;
            currentAmbulanceLoc.lng += 0.0015;

            // Update local map marker
            if (markers.ambulance) {
                markers.ambulance.setLatLng(currentAmbulanceLoc);
                maps['ambulance-view'].panTo(currentAmbulanceLoc);
            }

            // Send to server
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "location_update",
                    trip_id: window.currentTripId || "sim_trip",
                    lat: currentAmbulanceLoc.lat,
                    lng: currentAmbulanceLoc.lng
                }));
            }
        }, 3000);
    });
});

function initMapForView(viewId) {
    if (maps[viewId]) {
        maps[viewId].invalidateSize();
        return;
    }

    const mapContainerId = viewId.replace('view', 'map');
    
    // Check if container exists
    const container = document.getElementById(mapContainerId);
    if (!container) return;

    maps[viewId] = L.map(mapContainerId, {
        zoomControl: false // Disable zoom for clean UI
    }).setView([currentAmbulanceLoc.lat, currentAmbulanceLoc.lng], 13); // Start near user if possible

    // OpenStreetMap standard tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(maps[viewId]);

    // Add marker for Ambulance Map
    if (viewId === 'ambulance-view') {
        markers.ambulance = L.circleMarker([currentAmbulanceLoc.lat, currentAmbulanceLoc.lng], {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 1,
            radius: 8
        }).addTo(maps[viewId]).bindPopup("Ambulance Unit 42").openPopup();
    }
}

function setupWebSocket(role) {
    if (ws) {
        ws.close();
    }

    // Determine WebSocket protocol based on page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Connect to specific role endpoint
    ws = new WebSocket(`${protocol}//${host}/ws/${role}`);

    ws.onopen = () => {
        console.log(`Connected to websocket as ${role}`);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received via WS:", data);

        if (data.type === "trip_started") {
            window.currentTripId = data.trip_id;
        }

        if (role === 'hospital' || role === 'police') {
            if (data.type === "new_emergency") {
                addAlertCard(role, "NEW TRAUMA INCOMING", "ETA: 8 mins. Please prepare.");
            }
            if (data.type === "ambulance_location") {
                updateAmbulanceOnMap(`${role}-view`, data.lat, data.lng, data.trip_id);
            }
        }
    };

    ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
    };
}

function updateAmbulanceOnMap(viewId, lat, lng, tripId) {
    const map = maps[viewId];
    if (!map) return;

    if (!markers.hospital[tripId]) {
        // Red marker for incoming ambulance
        markers.hospital[tripId] = L.circleMarker([lat, lng], {
            color: '#ef4444', 
            fillColor: '#ef4444',
            fillOpacity: 1,
            radius: 10
        }).addTo(map);
        
        // Remove empty states
        if (viewId === 'hospital-view') {
            document.getElementById('hospital-arrivals-list').innerHTML = '';
        } else if (viewId === 'police-view') {
            document.getElementById('police-alerts-list').innerHTML = '';
        }
    } else {
        markers.hospital[tripId].setLatLng([lat, lng]);
        map.panTo([lat, lng]);
    }
}

// Function to fetch and render real hospitals, police stations, and traffic signals using Overpass API
async function fetchRealWorldEntities(lat, lng, viewId) {
    const map = maps[viewId];
    if (!map) return;

    // Dramatically increase radius to find all hospitals in a wide city area (15km)
    const radius = 15000;
    
    // Query Overpass for amenities: hospitals, clinics, police, traffic_signals, and major road crossings (high traffic)
    const overpassQuery = `
        [out:json][timeout:35];
        (
          node["amenity"~"hospital|clinic"](around:${radius},${lat},${lng});
          node["amenity"~"police|fire_station"](around:${radius},${lat},${lng});
          node["highway"~"traffic_signals|crossing|motorway_junction"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
    `;

    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Custom Icons
        const hospitalIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        const policeIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        const trafficIcon = L.circleMarker(null, {
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.8,
            radius: 5
        });

        data.elements.forEach(element => {
            if (element.type === 'node') {
                const elLat = element.lat;
                const elLng = element.lon;
                let marker;

                if (element.tags && (element.tags.amenity === 'hospital' || element.tags.amenity === 'clinic')) {
                    const name = element.tags.name || "Unknown Hospital";
                    marker = L.marker([elLat, elLng], { icon: hospitalIcon }).bindPopup(name + " (Emergency Reroute Ready)");
                    
                    // Add hospital to the selector drop-down dynamically if in ambulance view
                    if (viewId === 'ambulance-view') {
                        const select = document.getElementById('hospital-select');
                        const option = document.createElement('option');
                        option.value = element.id;
                        option.text = name;
                        select.add(option);
                    }
                } 
                else if (element.tags && (element.tags.amenity === 'police' || element.tags.amenity === 'fire_station')) {
                    const name = element.tags.name || (element.tags.amenity === 'police' ? "Police Station" : "Fire Dept");
                    marker = L.marker([elLat, elLng], { icon: policeIcon }).bindPopup(name + " (Traffic Command Support)");
                } 
                else if (element.tags && (element.tags.highway === 'traffic_signals' || element.tags.highway === 'crossing' || element.tags.highway === 'motorway_junction')) {
                    
                    let markerColor = '#f59e0b'; // Default orange (traffic signal)
                    let text = "Traffic Signal Node (Clearance Active)";
                    
                    if(element.tags.highway === 'motorway_junction') {
                         markerColor = '#ef4444'; // Red for High Traffic / Highway junction
                         text = "High Traffic Route Node (Highway Junction)";
                    }
                    else if(element.tags.highway === 'crossing') {
                         markerColor = '#eab308'; // Yellow for Pedestrian Crossings
                         text = "Pedestrian Crossing (Caution Zone)";
                    }

                    marker = L.circleMarker([elLat, elLng], {
                        color: markerColor,
                        fillColor: markerColor,
                        fillOpacity: 0.7,
                        radius: element.tags.highway === 'motorway_junction' ? 8 : 4
                    }).bindPopup(text);
                }

                if (marker) {
                    marker.addTo(map);
                    markers.realEntities.push(marker);
                }
            }
        });

        // Clear existing static mockup options if we found real hospitals
        if (viewId === 'ambulance-view' && document.getElementById('hospital-select').options.length > 2) {
             const sel = document.getElementById('hospital-select');
             for (let i=0; i<2; i++) sel.remove(0); // remove h1, h2
        }

    } catch (err) {
        console.error("Failed to fetch real-world entities:", err);
    }
}

function addAlertCard(role, title, msg) {
    const containerId = role === 'police' ? 'police-alerts-list' : 'hospital-arrivals-list';
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear empty state text on first append
    if (container.querySelector('.empty-state')) {
        container.innerHTML = '';
    }

    const card = document.createElement('div');
    card.className = 'alert-card';
    card.innerHTML = `
        <h4>${title}</h4>
        <p>${msg}</p>
    `;
    container.prepend(card);
}
