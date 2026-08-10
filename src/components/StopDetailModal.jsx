import React, { useState, useEffect } from 'react';
import { fetchStopETAs, getFallbackETAs } from '../services/avanzaApi';
import { SORIA_LINES } from '../data/soriaLines';
import { CAMARETAS_TIMETABLE } from '../data/camaretasSchedule';
import { AVANZA_FULL_SCHEDULES } from '../data/avanzaSchedules';
import { findMatchingStopInSchedule } from '../utils/stopMatcher';

export default function StopDetailModal({ stop, onClose }) {
  const isLcStop = stop.lines.includes('LC');
  const [activeTab, setActiveTab] = useState(isLcStop ? 'schedule' : 'realtime');
  const [etas, setEtas] = useState(() => isLcStop ? [] : getFallbackETAs(stop.id));
  const [isRefreshing, setIsRefreshing] = useState(!isLcStop);

  // Swipe-to-expand / Swipe-to-close state
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = React.useRef(0);

  const handleTouchStart = (e) => {
    if (!e.target.closest('.modal-drag-area')) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (!touchStartY.current) return;
    const currentY = e.touches[0].clientY;
    const dy = currentY - touchStartY.current;
    
    // If expanded, dragging down reduces height. Dragging up does nothing (already max).
    if (isExpanded) {
      if (dy > 0) setDragY(dy);
    } 
    // If collapsed, dragging up expands. Dragging down dismisses.
    else {
      setDragY(dy);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartY.current) return;
    touchStartY.current = 0;
    
    if (isExpanded) {
      if (dragY > 100) {
        setIsExpanded(false); // Collapse
      }
    } else {
      if (dragY < -50) {
        setIsExpanded(true); // Expand
      } else if (dragY > 100) {
        onClose(); // Dismiss
      }
    }
    setDragY(0);
  };

  useEffect(() => {
    if (isLcStop) return;

    let cancelled = false;
    async function load() {
      setIsRefreshing(true);
      const data = await fetchStopETAs(stop.id);
      if (!cancelled) {
        setEtas(data);
        setIsRefreshing(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [stop, isLcStop]);

  function getLineColor(lineCode) {
    const line = SORIA_LINES.find(l => l.code === lineCode);
    return line ? line.color : '#3b82f6';
  }

  const isFromCamaretasStop = stop.id === 'LC_CC' || stop.id === 'LC_CIVICO';

  const modalStyle = {
    transform: dragY !== 0 ? `translateY(${dragY}px)` : 'translateY(0)',
    height: isExpanded ? '95vh' : '75vh',
    transition: touchStartY.current === 0 ? 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1), transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-panel" 
        onClick={e => e.stopPropagation()}
        style={modalStyle}
      >
        <div 
          className="modal-drag-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
        >
          <div className="modal-drag-handle"></div>
          
          {/* Header */}
          <div className="modal-header" style={{ paddingTop: 8 }}>
            <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              <span className="line-badge" style={{ background: isLcStop ? '#d4af37' : 'var(--accent)', fontSize: 10 }}>
                #{stop.id}
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>{stop.name}</h3>
            </div>
            <p className="text-xs text-secondary">
              Líneas: {stop.lines.join(', ')}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        </div>

        {/* Tab switcher (Hidden for LC stops as they don't have real-time SAE) */}
      {!isLcStop && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="tab-switcher">
              <button className={activeTab === 'realtime' ? 'active' : ''} onClick={() => setActiveTab('realtime')}>
                ⏱️ Tiempo Real
              </button>
              <button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}>
                📅 Horarios Oficiales
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="modal-body">
          {activeTab === 'realtime' && !isLcStop && (
            <div className="space-y">
              {isRefreshing && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '8px' }}>
                  <span className="text-xxs text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <span style={{ fontSize: '12px' }}>🔄</span> Actualizando señal GPS de Avanza...
                  </span>
                </div>
              )}

              {etas.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>🌙</p>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>Sin autobuses próximos</p>
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>Servicio nocturno cerrado o sin expediciones en tiempo real.</p>
                </div>
              ) : (
                etas.map((eta, idx) => (
                  <div key={idx} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="line-badge" style={{ background: getLineColor(eta.desBusLine) }}>
                        {eta.desBusLine || '?'}
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
                            {eta.desArrivalBusStop || 'Destino'}
                          </p>
                          {eta.isLive ? (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 4, 
                              background: 'rgba(16, 185, 129, 0.18)', 
                              color: '#10b981', 
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              fontSize: 10, 
                              fontWeight: 800 
                            }}>
                              <span style={{ 
                                width: 6, 
                                height: 6, 
                                borderRadius: '50%', 
                                background: '#10b981', 
                                boxShadow: '0 0 6px #10b981'
                              }}></span>
                              📡 En Vivo
                            </span>
                          ) : (
                            <span style={{ 
                              display: 'inline-block', 
                              background: 'var(--bg-elevated)', 
                              color: 'var(--text-muted)', 
                              border: '1px solid var(--border-subtle)',
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              fontSize: 10 
                            }}>
                              📅 Programado
                            </span>
                          )}
                        </div>
                        <p className="text-xxs text-muted" style={{ marginTop: 2 }}>Bus #{eta.idBus || '—'}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: eta.isLive ? 'var(--green)' : 'var(--text-primary)' }}>
                        {eta.minutesArrive}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: eta.isLive ? 'var(--green)' : 'var(--text-primary)', marginLeft: 2 }}>min</span>
                      <p className="text-xxs text-muted" style={{ marginTop: 2 }}>{eta.arrivalTime}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {(activeTab === 'schedule' || isLcStop) && (
            <div className="space-y">
              {isLcStop ? (
                <div className="space-y">
                  {isFromCamaretasStop ? (
                    <div className="card space-y">
                      <h4 style={{ margin: '0 0 6px 0', fontSize: 14, color: 'var(--accent-text)' }}>
                        Salidas desde Camaretas ➔ Soria
                      </h4>
                      <div>
                        <div className="label text-xs mb-1">Lunes a Jueves</div>
                        <div className="flex gap-2 flex-wrap">
                          {CAMARETAS_TIMETABLE.departuresFromCamaretas.mondayToThursday.map((dep, idx) => (
                            <span key={idx} className="time-chip text-xs">{dep.time}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="label text-xs mb-1">Viernes y Sábados</div>
                        <div className="flex gap-2 flex-wrap">
                          {CAMARETAS_TIMETABLE.departuresFromCamaretas.fridayAndSaturday.map((dep, idx) => (
                            <span key={idx} className="time-chip text-xs">{dep.time}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="label text-xs mb-1" style={{ color: 'var(--amber)' }}>Domingos y Festivos</div>
                        <div className="flex gap-2 flex-wrap">
                          {CAMARETAS_TIMETABLE.departuresFromCamaretas.sunday.map((dep, idx) => (
                            <span key={idx} className="time-chip text-xs" style={{ background: 'var(--amber-soft)', color: '#fbbf24' }}>
                              {dep.time} ({dep.note})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="card space-y">
                      <h4 style={{ margin: '0 0 6px 0', fontSize: 14, color: 'var(--green)' }}>
                        Salidas desde Soria ➔ Camaretas
                      </h4>
                      <div>
                        <div className="label text-xs mb-1">Lunes a Jueves</div>
                        <div className="flex gap-2 flex-wrap">
                          {CAMARETAS_TIMETABLE.departuresFromSoria.mondayToThursday.map((dep, idx) => (
                            <span key={idx} className="time-chip text-xs">{dep.time}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="label text-xs mb-1">Viernes y Sábados</div>
                        <div className="flex gap-2 flex-wrap">
                          {CAMARETAS_TIMETABLE.departuresFromSoria.fridayAndSaturday.map((dep, idx) => (
                            <span key={idx} className="time-chip text-xs">{dep.time}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="label text-xs mb-1" style={{ color: 'var(--amber)' }}>Domingos y Festivos</div>
                        <div className="flex gap-2 flex-wrap">
                          {CAMARETAS_TIMETABLE.departuresFromSoria.sunday.map((dep, idx) => (
                            <span key={idx} className="time-chip text-xs" style={{ background: 'var(--amber-soft)', color: '#fbbf24' }}>
                              {dep.time} ({dep.note})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                stop.lines.map(lineCode => {
                  const line = SORIA_LINES.find(l => l.code === lineCode);
                  const fullSched = AVANZA_FULL_SCHEDULES[lineCode];
                  
                  if (!line) return null;
                  
                  // Find matching stop in fullSched
                  let matchedStop = findMatchingStopInSchedule(fullSched?.stops, stop);
                  return (
                    <div key={lineCode} className="card space-y">
                      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                        <span className="line-badge" style={{ background: line.color }}>{line.code}</span>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{line.shortName}</span>
                      </div>

                      {matchedStop ? (
                        <div>
                          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                            <p className="label text-xs" style={{ margin: 0, color: 'var(--accent-text)', fontWeight: 700 }}>
                              Horas de paso por esta parada (#{matchedStop.num} {matchedStop.name})
                            </p>
                            <span className="text-xxs text-muted">{matchedStop.tripTimes.filter(Boolean).length} expediciones</span>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {matchedStop.tripTimes.map((t, tripIdx) => {
                              if (!t) return null;
                              const isStarred = (fullSched.colTypes?.[tripIdx] || '').includes('*');
                              return (
                                <span
                                  key={tripIdx}
                                  className="time-chip text-xs"
                                  style={{
                                    fontWeight: 700,
                                    borderLeft: isStarred ? '2px solid var(--amber)' : '1px solid var(--border-subtle)',
                                    background: isStarred ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-elevated)'
                                  }}
                                  title={isStarred ? 'Expedición con prolongación por Calaverón / Polígono' : 'Expedición Estándar'}
                                >
                                  {t}{isStarred ? '*' : ''}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted">Consulta la tabla completa de la línea en el panel de Líneas.</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
