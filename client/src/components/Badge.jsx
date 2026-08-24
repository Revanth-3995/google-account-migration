import React from 'react';

export function Badge({ type, text }) {
  let styleClass = 'badge-neutral';
  const upper = String(type || '').toUpperCase();
  if (upper === 'DRIVE') styleClass = 'badge-drive';
  if (upper === 'PHOTOS') styleClass = 'badge-photos';
  if (upper === 'COMPLETED' || upper === 'READY' || upper === 'CONNECTED') styleClass = 'badge-success';
  if (upper === 'RUNNING' || upper === 'PROCESSING' || upper === 'WARNING') styleClass = 'badge-warning';
  if (upper === 'FAILED' || upper === 'CANCELLED' || upper === 'ERROR') styleClass = 'badge-error';

  return (
    <span className={`badge ${styleClass}`}>
      {text || type}
    </span>
  );
}
