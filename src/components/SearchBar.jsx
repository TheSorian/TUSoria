import React, { useState, useEffect, useRef } from 'react';
import { getAutocompleteSuggestions, planAddressRoute } from '../services/routePlanner';
import { useLiveData } from '../context/LiveDataContext';

export default function SearchBar({ onSelectStop, onRoutesFound, onResetSearch, userLocation }) {
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [destQuery, setDestQuery] = useState('');
  const [originQuery, setOriginQuery] = useState('');
  
  const [activeInput, setActiveInput] = useState('dest'); // 'origin' | 'dest'
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchContainerRef = useRef(null);
  const { getStopETAs } = useLiveData();

  // Close autocomplete on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = async (val, field) => {
    if (field === 'dest') {
      setDestQuery(val);
      setActiveInput('dest');
    } else {
      setOriginQuery(val);
      setActiveInput('origin');
    }

    if (!val || val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const items = await getAutocompleteSuggestions(val);
    setSuggestions(items);
    setShowDropdown(items.length > 0);
  };

  const handleSelectSuggestion = (item) => {
    if (activeInput === 'dest') {
      setDestQuery(item.name);
    } else {
      setOriginQuery(item.name);
    }
    setShowDropdown(false);
    if (onSelectStop) {
      onSelectStop(item);
    }
  };

  const handleSearchRoute = async () => {
    if (!destQuery.trim()) return;

    setIsSearching(true);
    setShowDropdown(false);

    // If no origin specified, use user's GPS location or fallback to "Mi ubicación actual"
    const origin = originQuery.trim() ? originQuery.trim() : (userLocation || 'Mi ubicación actual');
    const results = await planAddressRoute(origin, destQuery, userLocation, getStopETAs);
    
    setIsSearching(false);
    onRoutesFound(results);
  };

  const handleClear = () => {
    setDestQuery('');
    setOriginQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    onResetSearch();
  };

  const handleRequestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setOriginQuery('Mi ubicación actual');
        },
        (_err) => {
          alert('Por favor autoriza los permisos de ubicación en tu navegador para usar tu posición GPS.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Geolocalización no soportada por el navegador.');
    }
  };

  return (
    <div className="search-bar-wrapper" ref={searchContainerRef}>
      <div className="search-bar-card">
        {/* Advanced From/To Toggle */}
        <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: isAdvancedMode ? 8 : 0 }}>
          <div className="flex items-center gap-2" style={{ flex: 1 }}>
            <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', borderRadius: '8px', boxShadow: '0 2px 6px rgba(37,99,235,0.4)', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="16" rx="2" ry="2"></rect>
                <path d="M4 11h16"></path>
                <path d="M8 15h.01"></path>
                <path d="M16 15h.01"></path>
                <path d="M6 19v2"></path>
                <path d="M18 19v2"></path>
              </svg>
            </div>
            <input
              type="text"
              className="search-input"
              placeholder={isAdvancedMode ? "Hasta (Destino, Ej. Hospital)..." : "Buscar parada, lugar o destino en Soria..."}
              value={destQuery}
              onChange={(e) => handleInputChange(e.target.value, 'dest')}
              onFocus={async () => {
                setActiveInput('dest');
                if (destQuery.trim().length >= 2) {
                  const items = await getAutocompleteSuggestions(destQuery);
                  setSuggestions(items);
                  setShowDropdown(items.length > 0);
                }
              }}
            />
            {destQuery && (
              <button className="icon-btn-sm" onClick={handleClear}>✕</button>
            )}
          </div>

          <button
            type="button"
            className={`btn-chip-sm ${isAdvancedMode ? 'active' : ''}`}
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            title="Calcular ruta desde otro origen"
            style={{ marginLeft: 8 }}
          >
            {isAdvancedMode ? 'Simple' : '🧭 Desde/Hasta'}
          </button>
        </div>

        {/* Origin field when in Advanced Mode */}
        {isAdvancedMode && (
          <div className="flex items-center gap-2" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '1rem' }}>📍</span>
            <input
              type="text"
              className="search-input"
              placeholder={userLocation ? "Desde (Tu GPS actual u Origen)..." : "Desde (Ej. Mariano Granados u Origen)..."}
              value={originQuery}
              onChange={(e) => handleInputChange(e.target.value, 'origin')}
              onFocus={async () => {
                setActiveInput('origin');
                if (originQuery.trim().length >= 2) {
                  const items = await getAutocompleteSuggestions(originQuery);
                  setSuggestions(items);
                  setShowDropdown(items.length > 0);
                }
              }}
            />
            <button
              type="button"
              className="btn-chip-sm"
              onClick={handleRequestLocation}
              title="Obtener GPS actual"
            >
              📍 GPS
            </button>
            {originQuery && (
              <button className="icon-btn-sm" onClick={() => setOriginQuery('')}>✕</button>
            )}
          </div>
        )}

        {/* Action button if user has typed something or is in route mode */}
        {(destQuery.length > 1 || isAdvancedMode) && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginTop: 8, width: '100%' }}
            onClick={handleSearchRoute}
            disabled={isSearching}
          >
            {isSearching ? 'Calculando rutas...' : '🧭 Calcular Ruta'}
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="autocomplete-dropdown card">
          {suggestions.map((item) => (
            <div
              key={item.id}
              className="autocomplete-item"
              onClick={() => handleSelectSuggestion(item)}
            >
              <span className="autocomplete-icon">{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="autocomplete-title">{item.name}</div>
                <div className="autocomplete-subtitle">{item.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
