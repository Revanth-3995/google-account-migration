import React from 'react';
import { Link as LinkIcon, Loader2 } from 'lucide-react';

export const PRODUCT_NAME = import.meta.env.VITE_PRODUCT_NAME || 'Brand Name';
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'contact@example.com';

export function BrandMark({ variant = 'dark', className = '' }) {
  return (
    <span className={`brand-mark-image brand-mark-image--${variant} ${className}`.trim()} aria-hidden="true">
      <img src="/brand-mark.png" alt="" />
    </span>
  );
}

export function BrandLogo({ variant = 'dark', compact = false, showWordmark = true, className = '' }) {
  return (
    <div className={`brand-logo brand-logo--${variant} ${compact ? 'is-compact' : ''} ${className}`.trim()}>
      <div className="brand-logo__mark">
        <BrandMark variant={variant} className="brand-logo__svg" />
      </div>
      {showWordmark ? (
        <div className="brand-logo__copy">
          <strong>{PRODUCT_NAME}</strong>
          {!compact ? <span>Digital lineages, unbroken</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, meta }) {
  return (
    <header className="page-header">
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <div className="page-header__grid">
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {(actions || meta) && (
          <div className="page-header__aside">
            {meta ? <div className="page-header__meta">{meta}</div> : null}
            {actions ? <div className="page-header__actions">{actions}</div> : null}
          </div>
        )}
      </div>
    </header>
  );
}

export function SectionHeader({ number, title, description, actions }) {
  return (
    <div className="section-header">
      <div className="section-header__title">
        {number ? <span className="section-number">{number}</span> : null}
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="section-header__actions">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ tone = 'neutral', children, mono = false }) {
  return <span className={`status-badge tone-${tone} ${mono ? 'mono' : ''}`}>{children}</span>;
}

export function ProgressBar({ value = 0, label, detail, tone = 'green' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-block">
      {(label || detail) && (
        <div className="progress-block__top">
          {label ? <span>{label}</span> : <span />}
          {detail ? <span className="mono">{detail}</span> : null}
        </div>
      )}
      <div className="progress-track">
        <div className={`progress-fill tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, illustration }) {
  return (
    <div className="empty-state">
      {illustration ? <div className="empty-state__art">{illustration}</div> : null}
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'We could not load this section.', description, action }) {
  return (
    <div className="empty-state empty-state--error">
      <div className="empty-state__art">!</div>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({ lines = 3 }) {
  return (
    <div className="skeleton-card" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div className="skeleton-line" key={i} />
      ))}
    </div>
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, destructive = false }) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="dialog-title">{title}</h3>
        {description ? <p>{description}</p> : null}
        <div className="dialog__actions">
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function AppLinkButton({ href, children, primary = false, secondary = false }) {
  return (
    <a className={`btn ${primary ? 'btn-primary' : secondary ? 'btn-secondary' : 'btn-ghost'}`} href={href}>
      {children}
    </a>
  );
}

export function ReadMoreLink({ href, children }) {
  return (
    <a className="text-link" href={href}>
      {children} <LinkIcon size={14} />
    </a>
  );
}

export function Spinner() {
  return <Loader2 className="spin" size={16} aria-hidden="true" />;
}
