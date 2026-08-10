import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import NavigationTabs from './components/NavigationTabs';
import MapView from './components/MapView';
import LinesView from './components/LinesView';
import AlertsView from './components/AlertsView';
import StopDetailModal from './components/StopDetailModal';
import RouteResultsDrawer from './components/RouteResultsDrawer';
import { SERVICE_ALERTS } from './data/provisionalStops';

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [selectedStop, setSelectedStop] = useState(null);
  const [activeRouteOnMap, setActiveRouteOnMap] = useState(null);
  const [calculatedRoutes, setCalculatedRoutes] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [geoPermission, setGeoPermission] = useState('pending'); // 'pending' | 'granted' | 'denied'

  // Request Geolocation Permission on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoPermission('granted');
        },
        (err) => {
          console.warn('[TUSoria] Geolocation permission denied or unavailable:', err);
          setGeoPermission('denied');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  const handleShowRouteOnMap = (route) => {
    setActiveRouteOnMap(route);
    setActiveTab('map');
  };

  const handleRoutesFound = (routes) => {
    setCalculatedRoutes(routes);
  };

  const handleResetSearch = () => {
    setCalculatedRoutes(null);
    setActiveRouteOnMap(null);
  };

  return (
    <div className="app-shell">
      <SearchBar
        userLocation={userLocation}\n            selectedStop={selectedStop}
        geoPermission={geoPermission}
        alertsCount={SERVICE_ALERTS.length}
        onSelectStop={(stop) => {
          setSelectedStop(stop);
          setActiveTab('map');
        }}
        onRoutesFound={handleRoutesFound}
        onResetSearch={handleResetSearch}
      />

      <div className="main-content">
        {activeTab === 'map' && (
          <MapView
            onSelectStop={(stop) => setSelectedStop(stop)}
            activeRoute={activeRouteOnMap}
            userLocation={userLocation}\n            selectedStop={selectedStop}
          />
        )}
        {activeTab === 'lines' && (
          <div className="view-panel">
            <LinesView onSelectStop={(stop) => setSelectedStop(stop)} />
          </div>
        )}
        {activeTab === 'alerts' && (
          <div className="view-panel">
            <AlertsView />
          </div>
        )}
      </div>

      {calculatedRoutes && (
        <RouteResultsDrawer
          routes={calculatedRoutes}
          onClose={() => setCalculatedRoutes(null)}
          onShowOnMap={handleShowRouteOnMap}
        />
      )}

      {selectedStop && (
        <StopDetailModal
          stop={selectedStop}
          onClose={() => setSelectedStop(null)}
        />
      )}

      <NavigationTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'map') setActiveRouteOnMap(null);
        }}
        alertsCount={SERVICE_ALERTS.length}
      />
    </div>
  );
}
