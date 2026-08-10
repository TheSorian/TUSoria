import React from 'react';

const TABS = [
  { id: 'map',    label: 'Mapa',   icon: '🗺️' },
  { id: 'lines',  label: 'Líneas', icon: '🚌' },
  { id: 'alerts', label: 'Avisos', icon: '⚠️', hasBadge: true },
];

export default function NavigationTabs({ activeTab, onTabChange, alertsCount }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
          {tab.hasBadge && alertsCount > 0 && <span className="alert-dot" />}
        </button>
      ))}
    </nav>
  );
}
