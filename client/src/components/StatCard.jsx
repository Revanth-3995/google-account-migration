import React from 'react';

export function StatCard({ title, value, subtitle, icon: Icon, color = '#38bdf8' }) {
  return (
    <div className="card-surface">
      <div>
        <div className="eyebrow">{title}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1, marginTop: 6 }}>{value}</div>
        {subtitle && (
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 6 }}>
            {subtitle}
          </div>
        )}
      </div>
      {Icon && (
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${color}16`,
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
