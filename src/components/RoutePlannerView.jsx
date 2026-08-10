import React, { useState } from 'react';
import { planAddressRoute } from '../services/routePlanner';

const RoutePlannerView = ({ onShowOnMap }) => {
  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setOriginInput('Mi ubicación actual');
        },
        (error) => {
          console.error("Error obtaining location", error);
        }
      );
    } else {
      alert("Geolocalización no soportada por el navegador");
    }
  };

  const handleSearch = async () => {
    if (!originInput || !destInput) return;
    setIsSearching(true);
    try {
      const results = await planAddressRoute(originInput, destInput, userLocation);
      setRoutes(results || []);
    } catch (e) {
      console.error(e);
      setRoutes([]);
    } finally {
      setIsSearching(false);
    }
  };

  const suggestionChips = [
    'Mariano Granados', 'Hospital Sta. Bárbara', 'Estación Autobuses', 
    'Campus Pajaritos', 'CC Camaretas', 'Polígono'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
      <div className="card space-y">
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>🧭 Cómo llegar en autobús</h2>
        <p className="text-muted text-sm" style={{ margin: 0 }}>Introduce una dirección o lugar en Soria</p>

        <div className="space-y" style={{ marginTop: '1rem' }}>
          <div className="label">Desde:</div>
          <div className="flex gap-2 items-center">
            <input 
              className="input" 
              value={originInput} 
              onChange={e => setOriginInput(e.target.value)} 
              placeholder="Ej. Calle Caballeros 12" 
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="btn btn-outline" onClick={handleMyLocation} type="button">
              📍 Mi ubicación
            </button>
          </div>
        </div>

        <div className="space-y" style={{ marginTop: '1rem' }}>
          <div className="label">Hasta:</div>
          <input 
            className="input" 
            value={destInput} 
            onChange={e => setDestInput(e.target.value)} 
            placeholder="Ej. Hospital"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {suggestionChips.map(chip => (
            <span 
              key={chip} 
              className="chip" 
              style={{ cursor: 'pointer' }}
              onClick={() => setDestInput(chip)}
            >
              {chip}
            </span>
          ))}
        </div>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '1rem', display: 'block' }} 
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? 'Buscando...' : 'Buscar ruta'}
        </button>
      </div>

      {routes.length > 0 && (
        <div className="space-y">
          <h3 style={{ fontSize: '1.1rem', margin: '1rem 0 0.5rem 0' }}>Rutas recomendadas</h3>
          {routes.map((route, i) => {
            const isDirect = route.transfers === 0;
            return (
              <div key={i} className="card space-y">
                <div className="flex items-center" style={{ justifyContent: 'space-between' }}>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    fontSize: '0.85rem', 
                    color: '#fff',
                    backgroundColor: isDirect ? 'var(--color-green, #10b981)' : 'var(--color-amber, #f59e0b)'
                  }}>
                    {isDirect ? 'Directa' : '1 Transbordo'}
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{route.totalTime || route.duration} min</span>
                </div>
                
                <div className="timeline" style={{ marginTop: '1rem' }}>
                  {route.legs?.map((leg, j) => (
                    <div key={j} className="timeline-step flex gap-2">
                      <div className="timeline-dot flex items-center" style={{
                        backgroundColor: leg.mode === 'walk' ? '#9ca3af' : leg.mode === 'transfer' ? '#f59e0b' : (leg.lineColor || '#3b82f6'),
                        color: '#fff',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        justifyContent: 'center',
                        fontSize: '12px',
                        flexShrink: 0
                      }}>
                        {leg.mode === 'walk' && '🚶'}
                        {leg.mode === 'transfer' && '🔄'}
                        {leg.mode === 'bus' && (leg.lineCode || 'B')}
                      </div>
                      
                      <div style={{ flex: 1, paddingBottom: '1rem' }}>
                        {leg.mode === 'walk' && (
                          <div className="text-sm">
                            <div style={{ fontWeight: '500' }}>{leg.description || 'Caminar'}</div>
                            {leg.distance && <div className="text-xs text-muted">{leg.distance}</div>}
                          </div>
                        )}
                        {leg.mode === 'transfer' && (
                          <div className="text-sm">
                            <div style={{ fontWeight: '500' }} className="text-amber">{leg.description || 'Transbordo'}</div>
                          </div>
                        )}
                        {leg.mode === 'bus' && (
                          <div className="text-sm">
                            <div style={{ fontWeight: '500' }}>Línea {leg.lineCode}</div>
                            <div>Sube en <span style={{ fontWeight: '600' }}>{leg.boardStop}</span></div>
                            <div>Baja en <span style={{ fontWeight: '600' }}>{leg.alightStop}</span></div>
                            {leg.nextBusIn && <div className="text-accent text-xs" style={{ marginTop: '4px' }}>Próximo en ~{leg.nextBusIn} min</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2" style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                  <button className="btn btn-outline flex-1" style={{ flex: 1 }} onClick={() => onShowOnMap(route)}>
                    Ver en mapa
                  </button>
                  {route.googleMapsUrl && (
                    <a 
                      className="btn btn-outline flex-1" 
                      style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} 
                      href={route.googleMapsUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Abrir en Google Maps
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RoutePlannerView;
