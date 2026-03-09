import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';

// Replace with your local machine's IP address when running on a physical device.
// e.g., 'http://192.168.1.100:8000'
const BACKEND_URL = 'http://localhost:8000'; 

// Dummy Initial Coordinates (New York)
const INITIAL_REGION = {
  latitude: 40.7580,
  longitude: -73.9855,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// --- Shared Map Component using OpenStreetMap ---
const OpenStreetMap = ({ children, region }) => (
  <View style={styles.mapContainer}>
    <MapView
      style={styles.map}
      initialRegion={region}
      provider={PROVIDER_DEFAULT}
      mapType="none" // Important: disables default Apple/Google maps rendering
    >
      <UrlTile
        urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
      />
      {children}
    </MapView>
  </View>
);

// --- 1. Ambulance Portal ---
function AmbulanceScreen() {
  const [isTripActive, setIsTripActive] = useState(false);
  const [location, setLocation] = useState({ latitude: 40.7580, longitude: -73.9855 });

  const startTrip = () => {
    setIsTripActive(true);
    // In a real app, you would use expo-location to track and broadcast here
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ambulance Dispatch</Text>
      </View>
      <OpenStreetMap region={INITIAL_REGION}>
        <Marker coordinate={location} title="Ambulance Unit 42" pinColor="blue" />
      </OpenStreetMap>
      <View style={styles.panel}>
        <TouchableOpacity 
          style={[styles.button, isTripActive ? styles.buttonActive : null]}
          onPress={startTrip}
        >
          <Text style={styles.buttonText}>
            {isTripActive ? 'Broadcasting Location...' : 'Initiate Emergency Sequence'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- 2. Hospital Portal ---
function HospitalScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Emergency Room Dashboard</Text>
      </View>
      <OpenStreetMap region={INITIAL_REGION}>
        {/* Incoming ambulances will be rendered here dynamically */}
      </OpenStreetMap>
      <View style={styles.panel}>
        <Text style={styles.subtitle}>Incoming Ambulances</Text>
        <Text style={styles.emptyText}>No active incoming emergencies</Text>
      </View>
    </SafeAreaView>
  );
}

// --- 3. Police Portal ---
function PoliceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Traffic Control Center</Text>
      </View>
      <OpenStreetMap region={INITIAL_REGION}>
        {/* Incoming ambulances will be rendered here dynamically */}
      </OpenStreetMap>
      <View style={styles.panel}>
        <Text style={styles.subtitle}>Jurisdiction Alerts</Text>
        <Text style={styles.emptyText}>Traffic normal. No emergency vehicles in sector.</Text>
      </View>
    </SafeAreaView>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#64748b',
        }}
      >
        <Tab.Screen name="Paramedic" component={AmbulanceScreen} />
        <Tab.Screen name="Hospital" component={HospitalScreen} />
        <Tab.Screen name="Police" component={PoliceScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  header: {
    padding: 20,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f3f4f6',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f3f4f6',
    marginBottom: 10,
  },
  mapContainer: {
    flex: 1,
    width: Dimensions.get('window').width,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    padding: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  button: {
    backgroundColor: '#ef4444',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  buttonActive: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  }
});
