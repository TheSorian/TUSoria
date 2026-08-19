import React from 'react';

const TABS = [
  { id: 'map',    label: 'Mapa',   icon: '🗺️' },
  { id: 'lines',  label: 'Líneas', icon: '🚌' },
  { id: 'alerts', label: 'Avisos', icon: '⚠️', hasBadge: true },
];

export default function NavigationTabs({ activeTab, onTabChange, alertsCount }) {
  return (
    <nav className="bottom-nav" role="tablist" aria-label="Navegación principal de la aplicación">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-label={tab.label}
          className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
          {tab.hasBadge && alertsCount > 0 && <span className="alert-dot" aria-label="Nuevos avisos" />}
        </button>
      ))}
    </nav>
  );
}
