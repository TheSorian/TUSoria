import React from 'react';

export default function RouteResultsDrawer({ routes, onClose, onShowOnMap }) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="drawer-overlay">
      <div className="drawer-panel card space-y">
        <div className="flex items-center" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>🧭 Rutas en autobús encontradas</h3>
            <p className="text-xs text-muted" style={{ margin: 0 }}>Rutas optimizadas para la red de Soria</p>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="space-y" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {routes.map((route, i) => {
            const isDirect = route.transfers === 0;
            return (
              <div key={route.id || i} className="card" style={{ borderLeft: `4px solid ${isDirect ? '#10b981' : '#f59e0b'}` }}>
                <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span className="chip" style={{ 
                    background: isDirect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: isDirect ? '#10b981' : '#f59e0b',
                    fontWeight: 600
                  }}>
                    {isDirect ? '✓ Ruta Directa' : '🔄 1 Transbordo'}
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    {route.departureTimeFormatted && route.arrivalTimeFormatted ? (
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                          {route.departureTimeFormatted} ➔ {route.arrivalTimeFormatted}
                        </span>
                        <span className="text-xxs text-muted" style={{ display: 'block' }}>
                          (~{route.totalTimeMin} min total)
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>
                        ~{route.totalTimeMin} min
                      </span>
                    )}
                  </div>
                </div>

                {/* Schedule Advice Banner */}
                {route.timeMode === 'arrive_by' && route.departureTimeFormatted && (
                  <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', padding: '6px 8px', fontSize: '11px', color: 'var(--accent-text)', marginBottom: '0.5rem' }}>
                    🏁 Para llegar a las <b>{route.targetTimeStr}</b>, sal a pie a las <b>{route.departureTimeFormatted}</b>.
                  </div>
                )}
                {route.timeMode === 'depart_at' && route.arrivalTimeFormatted && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '6px 8px', fontSize: '11px', color: '#10b981', marginBottom: '0.5rem' }}>
                    🕐 Saliendo a las <b>{route.targetTimeStr}</b>, llegarás sobre las <b>{route.arrivalTimeFormatted}</b>.
                  </div>
                )}

                {/* Timeline */}
                <div className="timeline" style={{ marginTop: '0.5rem' }}>
                  {route.legs?.map((leg, j) => (
                    <div key={j} className="timeline-step flex gap-2">
                      <div className="timeline-dot flex items-center" style={{
                        backgroundColor: leg.mode === 'walk' ? '#6b7280' : leg.mode === 'transfer' ? '#f59e0b' : (leg.lineColor || '#3b82f6'),
                        color: '#fff',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        justifyContent: 'center',
                        fontSize: '11px',
                        flexShrink: 0
                      }}>
                        {leg.mode === 'walk' && '🚶'}
                        {leg.mode === 'transfer' && '🔄'}
                        {leg.mode === 'bus' && (leg.lineCode || 'B')}
                      </div>

                      <div style={{ flex: 1, paddingBottom: '0.75rem' }}>
                        {leg.mode === 'walk' && (
                          <div className="text-sm">
                            <div style={{ fontWeight: 500 }}>{leg.description}</div>
                            <div className="text-xs text-muted">
                              {leg.startTime && leg.endTime ? `${leg.startTime} ➔ ${leg.endTime} · ` : ''}
                              ~{leg.distanceMeters || Math.round((leg.timeMin || 1) * 70)} m ({leg.timeMin} min a pie)
                            </div>
                          </div>
                        )}

                        {leg.mode === 'bus' && (
                          <div className="text-sm">
                            <div className="flex items-center gap-2">
                              <span className="line-badge" style={{ background: leg.lineColor }}>{leg.lineCode}</span>
                              <span style={{ fontWeight: 600 }}>Sube en: {leg.boardStop} {leg.boardTime ? `(${leg.boardTime})` : ''}</span>
                            </div>
                            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                              Baja en: <strong>{leg.alightStop}</strong> {leg.alightTime ? `(${leg.alightTime})` : ''} (~{leg.timeMin} min en bus)
                            </div>
                            {leg.departureLabel && (
                              <div className="text-xxs text-secondary" style={{ marginTop: 2 }}>
                                {leg.departureLabel}
                              </div>
                            )}
                          </div>
                        )}

                        {leg.mode === 'transfer' && (
                          <div className="text-sm text-amber" style={{ fontWeight: 500 }}>
                            {leg.description}
                            {leg.startTime && leg.endTime && (
                              <div className="text-xxs text-muted">{leg.startTime} ➔ {leg.endTime}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      onShowOnMap(route);
                      onClose();
                    }}
                  >
                    🗺️ Ver en Mapa
                  </button>
                  <a
                    href={route.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    ↗️ Google Maps
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
