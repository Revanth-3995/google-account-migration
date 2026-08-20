import React from 'react';

export function StatCard({ title, value, subtitle, icon: Icon, color = '#38bdf8' }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 16,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }}>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f3f4f6' }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>
      {Icon && (
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: `${color}15`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color
        }}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}
