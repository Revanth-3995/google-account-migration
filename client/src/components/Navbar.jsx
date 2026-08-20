import React from 'react';
import { useApp } from '../context/AppContext';
import { HardDrive, Image, Activity, ShieldCheck, History, Settings, UserCheck } from 'lucide-react';

export function Navbar({ activeTab, setActiveTab }) {
  const { sourceAccount, destAccount, sseConnected } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'accounts', label: 'Accounts', icon: UserCheck },
    { id: 'drive', label: 'Google Drive', icon: HardDrive },
    { id: 'photos', label: 'Google Photos', icon: Image },
    { id: 'jobs', label: 'Jobs', icon: ShieldCheck },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header style={{
      backgroundColor: '#0d1322',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px'
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 64
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            color: '#090d16'
          }}>
            GM
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f3f4f6' }}>Drive & Photos Manager</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Privacy-First Control Plane</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: 4 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#38bdf8' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontSize: '0.75rem',
            padding: '4px 8px',
            borderRadius: 12,
            background: sseConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: sseConnected ? '#10b981' : '#ef4444',
            border: `1px solid ${sseConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 5
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: sseConnected ? '#10b981' : '#ef4444'
            }}></span>
            {sseConnected ? 'Live Telemetry' : 'Offline'}
          </div>

          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            borderLeft: '1px solid var(--border)',
            paddingLeft: 10
          }}>
            {sourceAccount && destAccount ? (
              <span style={{ color: '#38bdf8' }}>Accounts Ready</span>
            ) : (
              <span style={{ color: '#f59e0b' }}>Setup Required</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
