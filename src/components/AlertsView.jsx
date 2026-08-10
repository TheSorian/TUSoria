import React from 'react';
import { SERVICE_ALERTS } from '../data/provisionalStops';

export default function AlertsView() {
  return (
    <div className="space-y">
      <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
        <h2 style={{ margin: '0 0 0.25rem 0' }}>Incidencias y Obras</h2>
        <p className="text-sm text-accent" style={{ margin: 0 }}>Alertas activas en la red de TUSoria</p>
      </div>

      <div className="space-y">
        {SERVICE_ALERTS.map(alert => (
          <div key={alert.id} className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="flex items-center gap-2" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{alert.title}</h3>
              <span className="chip text-xs">{alert.date}</span>
            </div>
            <p className="text-sm" style={{ margin: '0 0 0.75rem 0' }}>{alert.description}</p>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {alert.lines.map(line => (
                <span key={`alert-${alert.id}-${line}`} className="line-badge">{line}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
