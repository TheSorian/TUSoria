import React, { useState } from 'react';
import { SORIA_LINES } from '../data/soriaLines';
import { SORIA_ALL_STOPS } from '../data/soriaLinesData';
import { CAMARETAS_TIMETABLE } from '../data/camaretasSchedule';
import { AVANZA_FULL_SCHEDULES } from '../data/avanzaSchedules';

export default function LinesView({ onSelectStop }) {
  const [selectedLine, setSelectedLine] = useState(SORIA_LINES[0]);
  const [activeTab, setActiveTab] = useState('schedule');
  const [selectedStopIdx, setSelectedStopIdx] = useState(0);
  const [showFullTable, setShowFullTable] = useState(false);
  const [isReverseDirection, setIsReverseDirection] = useState(false);

  const isLcLine = selectedLine.code === 'LC';
  const currentTab = isLcLine ? 'schedule' : activeTab;

  const rawLineStops = SORIA_ALL_STOPS.filter(s => s.lines.includes(selectedLine.code));
  const lineStops = isReverseDirection ? [...rawLineStops].reverse() : rawLineStops;

  const fullSched = AVANZA_FULL_SCHEDULES[selectedLine.code];
  const activeStop = fullSched?.stops?.[selectedStopIdx] || fullSched?.stops?.[0];

  return (
    <div className="space-y" style={{ maxWidth: 800, margin: '0 auto' }}>
      
      {/* Green Update Banner */}
      <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--green)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>✅ Actualizado: Horarios oficiales por parada con y sin Calaverón (*)</span>
      </div>

      {/* Line Chips Selector */}
      <div className="flex gap-2 no-scrollbar" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {SORIA_LINES.map(line => {
          const isSelected = selectedLine.id === line.id;
          return (
            <button
              key={line.id}
              className={`chip ${isSelected ? 'active' : ''}`}
              onClick={() => {
                setSelectedLine(line);
                setSelectedStopIdx(0);
                if (line.code === 'LC') setActiveTab('schedule');
              }}
            >
              <span className="dot" style={{ background: line.color }} />
              <span>{line.code}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Line Card */}
      <div className="card card-accent" style={{ borderLeftColor: selectedLine.color }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <span className="line-badge" style={{ background: selectedLine.color }}>
            {selectedLine.code}
          </span>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedLine.name}</h2>
        </div>
        <p className="text-xs text-secondary" style={{ marginBottom: 12 }}>{selectedLine.shortName}</p>
        
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span className="label" style={{ display: 'block', marginBottom: 2 }}>Sentido de Circulación</span>
            <span className="text-xs fw-700" style={{ color: 'var(--accent-text)' }}>
              {isReverseDirection && selectedLine.terminals[1] 
                ? `🧭 ${selectedLine.terminals[1]} ➔ ${selectedLine.terminals[0]}`
                : `🧭 ${selectedLine.terminals[0]} ➔ ${selectedLine.terminals[1] || 'Recorrido Circular'}`}
            </span>
          </div>
          {selectedLine.terminals.length > 1 && (
            <button
              type="button"
              className="chip"
              onClick={() => setIsReverseDirection(!isReverseDirection)}
              style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
            >
              🔄 Cambiar Sentido
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher (Hidden for LC since LC only has fixed schedules) */}
      {!isLcLine && (
        <div className="tab-switcher">
          <button
            className={currentTab === 'realtime' ? 'active' : ''}
            onClick={() => setActiveTab('realtime')}
          >
            ⏱️ Tiempos en Vivo
          </button>
          <button
            className={currentTab === 'schedule' ? 'active' : ''}
            onClick={() => setActiveTab('schedule')}
          >
            📅 Horarios por Parada
          </button>
        </div>
      )}

      {/* Tab 1: Real-time Stops */}
      {currentTab === 'realtime' && !isLcLine && (
        <div className="space-y">
          <div className="flex items-center justify-between">
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Paradas de la línea ({lineStops.length})</h3>
            <span className="live-badge">SAE Live</span>
          </div>

          <div className="space-y-sm">
            {lineStops.map(stop => (
              <div
                key={stop.id}
                className="card interactive"
                onClick={() => onSelectStop(stop)}
                style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', padding: '12px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <span className="line-badge" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                    #{stop.id}
                  </span>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{stop.name}</h4>
                    <p className="text-xxs text-muted" style={{ marginTop: 2 }}>Líneas: {stop.lines.join(', ')}</p>
                  </div>
                </div>
                <span className="text-xs text-accent fw-700" style={{ marginLeft: 8 }}>Ver →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Scheduled Timetable */}
      {currentTab === 'schedule' && (
        <div className="space-y">
          {isLcLine ? (
            <div className="space-y">
              
              {/* Salidas desde Camaretas -> Soria */}
              <div className="card">
                <h3 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--accent-text)' }}>
                  🚌 Salidas desde CAMARETAS ➔ SORIA
                </h3>
                <p className="text-xxs text-muted" style={{ marginBottom: 12 }}>
                  Centro Cívico ➔ Parada Centro Comercial ➔ Estación de Autobuses ➔ Avda. Duques de Soria
                </p>

                <div className="space-y">
                  <div>
                    <div className="label text-xs mb-1" style={{ color: 'var(--text-primary)' }}>Lunes a Jueves</div>
                    <div className="flex gap-2 flex-wrap">
                      {CAMARETAS_TIMETABLE.departuresFromCamaretas.mondayToThursday.map((dep, idx) => (
                        <span key={idx} className="time-chip text-sm" style={{ borderLeft: dep.isNew ? '2px solid var(--green)' : '1px solid var(--border-subtle)' }}>
                          {dep.time}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="label text-xs mb-1" style={{ color: 'var(--text-primary)' }}>Viernes y Sábados</div>
                    <div className="flex gap-2 flex-wrap">
                      {CAMARETAS_TIMETABLE.departuresFromCamaretas.fridayAndSaturday.map((dep, idx) => (
                        <span key={idx} className="time-chip text-sm" style={{ borderLeft: dep.isNew ? '2px solid var(--green)' : '1px solid var(--border-subtle)' }}>
                          {dep.time}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="label text-xs mb-1" style={{ color: 'var(--amber)' }}>Domingos y Festivos</div>
                    <div className="flex gap-2 flex-wrap">
                      {CAMARETAS_TIMETABLE.departuresFromCamaretas.sunday.map((dep, idx) => (
                        <span key={idx} className="time-chip text-sm" style={{ background: 'var(--amber-soft)', color: '#fbbf24' }}>
                          {dep.time} ({dep.note})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Salidas desde Soria -> Camaretas */}
              <div className="card">
                <h3 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--green)' }}>
                  🚌 Salidas desde SORIA ➔ CAMARETAS
                </h3>
                <p className="text-xxs text-muted" style={{ marginBottom: 12 }}>
                  Avda. Duques de Soria ➔ Estación de Autobuses ➔ Parada Centro Comercial ➔ Centro Cívico
                </p>

                <div className="space-y">
                  <div>
                    <div className="label text-xs mb-1" style={{ color: 'var(--text-primary)' }}>Lunes a Jueves</div>
                    <div className="flex gap-2 flex-wrap">
                      {CAMARETAS_TIMETABLE.departuresFromSoria.mondayToThursday.map((dep, idx) => (
                        <span key={idx} className="time-chip text-sm" style={{ borderLeft: dep.isNew ? '2px solid var(--green)' : '1px solid var(--border-subtle)' }}>
                          {dep.time}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="label text-xs mb-1" style={{ color: 'var(--text-primary)' }}>Viernes y Sábados</div>
                    <div className="flex gap-2 flex-wrap">
                      {CAMARETAS_TIMETABLE.departuresFromSoria.fridayAndSaturday.map((dep, idx) => (
                        <span key={idx} className="time-chip text-sm" style={{ borderLeft: dep.isNew ? '2px solid var(--green)' : '1px solid var(--border-subtle)' }}>
                          {dep.time}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="label text-xs mb-1" style={{ color: 'var(--amber)' }}>Domingos y Festivos</div>
                    <div className="flex gap-2 flex-wrap">
                      {CAMARETAS_TIMETABLE.departuresFromSoria.sunday.map((dep, idx) => (
                        <span key={idx} className="time-chip text-sm" style={{ background: 'var(--amber-soft)', color: '#fbbf24' }}>
                          {dep.time} ({dep.note})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y">
              {/* Stop Selector for Official Schedule */}
              <div className="card space-y">
                <div>
                  <label className="label text-xs mb-1" style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 700 }}>
                    🚏 Selecciona la parada para ver su horario oficial:
                  </label>
                  {fullSched?.stops && (
                    <select
                      className="input"
                      value={selectedStopIdx}
                      onChange={(e) => setSelectedStopIdx(Number(e.target.value))}
                      style={{ width: '100%', background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontWeight: 600 }}
                    >
                      {fullSched.stops.map((st, idx) => {
                        const validTimesCount = st.tripTimes.filter(Boolean).length;
                        return (
                          <option key={idx} value={idx}>
                            #{st.num} — {st.name} ({validTimesCount} expediciones)
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {activeStop && (
                  <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-text)' }}>
                        Horas de paso en #{activeStop.num} {activeStop.name}
                      </h4>
                      <span className="text-xxs text-muted">{activeStop.tripTimes.filter(Boolean).length} expediciones</span>
                    </div>

                    <div className="flex gap-2 flex-wrap" style={{ marginBottom: 12 }}>
                      {activeStop.tripTimes.map((t, tripIdx) => {
                        if (!t) return null;
                        const colType = fullSched.colTypes?.[tripIdx] || '';
                        const isStarred = colType.includes('*');

                        return (
                          <span
                            key={tripIdx}
                            className="time-chip text-sm"
                            style={{
                              fontWeight: 700,
                              borderLeft: isStarred ? '3px solid var(--amber)' : '1px solid var(--border-subtle)',
                              background: isStarred ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-elevated)'
                            }}
                            title={isStarred ? 'Expedición con prolongación por Calaverón / Polígono' : 'Expedición Estándar'}
                          >
                            {t}{isStarred ? '*' : ''}
                          </span>
                        );
                      })}
                    </div>

                    <div className="text-xxs text-muted flex items-center gap-2" style={{ paddingTop: 6, borderTop: '1px dashed var(--border-subtle)' }}>
                      <span style={{ color: 'var(--amber)', fontWeight: 'bold' }}>*</span>
                      <span>Horarios marcados con asterisco (<b>*</b>) realizan prolongación por <b>Calaverón</b> (L1/L3) o <b>Polígono</b> (L2).</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Expandable Complete Table */}
              <div className="card">
                <button
                  type="button"
                  className="btn btn-outline btn-block text-xs"
                  onClick={() => setShowFullTable(!showFullTable)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>{showFullTable ? '▲ Ocultar Tabla Completa' : '📋 Ver Tabla Completa de Todas las Paradas'}</span>
                </button>

                {showFullTable && fullSched?.stops && (
                  <div style={{ marginTop: 12, overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Parada</th>
                          {fullSched.colTypes.map((col, idx) => (
                            <th key={idx} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 10, color: col.includes('*') ? 'var(--amber)' : 'var(--text-secondary)' }}>
                              T{idx + 1}{col.includes('*') ? '*' : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fullSched.stops.map((st, sIdx) => (
                          <tr key={sIdx} style={{ borderBottom: '1px solid var(--border-subtle)', background: sIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{st.num}</td>
                            <td style={{ padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{st.name}</td>
                            {st.tripTimes.map((t, tripIdx) => {
                              const isStarred = (fullSched.colTypes?.[tripIdx] || '').includes('*');
                              return (
                                <td key={tripIdx} style={{ padding: '4px 2px', textAlign: 'center', fontSize: 10, fontWeight: t ? 600 : 400, color: t ? (isStarred ? 'var(--amber)' : 'var(--text-primary)') : 'var(--text-muted)' }}>
                                  {t || '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
