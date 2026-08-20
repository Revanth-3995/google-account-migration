import React from 'react';

export function Badge({ type, text }) {
  let styleClass = 'badge-neutral';
  if (type === 'DRIVE') styleClass = 'badge-drive';
  if (type === 'PHOTOS') styleClass = 'badge-photos';
  if (type === 'COMPLETED' || type === 'READY') styleClass = 'badge-success';
  if (type === 'RUNNING' || type === 'PROCESSING') styleClass = 'badge-warning';
  if (type === 'FAILED' || type === 'CANCELLED') styleClass = 'badge-error';

  return (
    <span className={`badge ${styleClass}`}>
      {text || type}
    </span>
  );
}
