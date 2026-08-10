import React, { useState, useEffect } from 'react';

export default function Header({ alertsCount, geoPermission }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    }
  };

  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">🚌</div>
        <div className="brand-text">
          <h1>Soria<span>Bus</span> <span className="live-badge">En Vivo</span></h1>
          <p>Autobuses urbanos de Soria y Las Camaretas</p>
        </div>
      </div>
      <div className="header-actions">
        {geoPermission === 'granted' && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--green)',
            background: 'var(--green-soft)',
            padding: '3px 7px',
            borderRadius: 6,
            border: '1px solid rgba(34,197,94,0.2)'
          }}>
            📍 GPS Activo
          </span>
        )}
        {alertsCount > 0 && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--amber)',
            background: 'var(--amber-soft)',
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid rgba(245,158,11,0.2)'
          }}>
            ⚠️ {alertsCount} aviso{alertsCount > 1 ? 's' : ''}
          </span>
        )}
        {deferredPrompt && (
          <button className="btn-primary" onClick={handleInstall}
            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8 }}>
            📲 Instalar
          </button>
        )}
      </div>
    </header>
  );
}
