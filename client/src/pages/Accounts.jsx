import React from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { PageHeader, ProgressBar, StatusBadge, ConfirmDialog } from '../components/ui';
import { UserCheck, Shield, Trash2, RefreshCw, ArrowDown } from 'lucide-react';

export function Accounts() {
  const {
    sourceAccount,
    destAccount,
    sourceLifetime,
    destLifetime,
    promptLogin,
    refreshAccounts,
    isAuthenticating,
    migrationAuthState
  } = useApp();
  const [confirmRole, setConfirmRole] = React.useState(null);

  const disconnectAccount = async (role) => {
    if (confirmRole !== role) return;
    await api.deleteAccount(role);
    setConfirmRole(null);
    refreshAccounts();
  };

  const accountCard = (role, account, lifetime, tone) => (
    <article className="account-card card-surface">
      <div className="account-card__top">
        <div>
          <div className="eyebrow">{role === 'source' ? 'SOURCE · Account A' : 'DESTINATION · Account B'}</div>
          <h3>{role === 'source' ? 'The account you are moving from' : 'The account you are moving to'}</h3>
        </div>
        <Badge type={account ? 'COMPLETED' : 'READY'} text={account ? 'Connected' : 'Not connected'} />
      </div>

      <p className="account-card__lede">
        {role === 'source'
          ? 'Authorizes Drive browsing and Google Photos picker access.'
          : 'Receives the copied Drive and Photos content.'}
      </p>

      <div className="account-card__body">
        {account ? (
          <>
            <div className="account-email">{account.email}</div>
            <div className="account-scopes mono">Scopes: {account.scopes}</div>
            <ProgressBar
              value={lifetime.expiresAt ? Math.max(0, 100 - Math.min(100, ((lifetime.remainingMs || 0) / ((lifetime.remainingMs || 1) + 1)) * 100)) : 0}
              label={lifetime.remainingLabel}
              detail={lifetime.detailLabel}
              tone={tone}
            />
            <div className="card-actions">
              <button className={`btn ${role === 'source' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => promptLogin(role)} disabled={isAuthenticating}>
                <RefreshCw size={14} className={isAuthenticating ? 'spin' : ''} /> Refresh token / re-auth
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmRole(role)}>
                <Trash2 size={14} /> Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="empty-inline">
              <Shield size={18} />
              <p>{role === 'source' ? 'Connect the Google account you are moving from.' : 'Connect the Google account you are moving to.'}</p>
            </div>
            <button className={`btn ${role === 'source' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => promptLogin(role)} disabled={isAuthenticating}>
              <UserCheck size={16} /> Connect {role === 'source' ? 'Source Account' : 'Destination Account'}
            </button>
          </>
        )}
      </div>
    </article>
  );

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Account connection"
        title="Connect source and destination accounts"
        description="The distinction stays explicit: Account A is the source, Account B is the destination."
        meta={<StatusBadge tone={migrationAuthState.ready ? 'green' : 'amber'} mono>{migrationAuthState.ready ? 'Migration ready' : migrationAuthState.state}</StatusBadge>}
      />

      <section className="hero-bridge card-surface">
        <div className="hero-bridge__stack">
          <div className="hero-bridge__column">
            <span className="mono">SOURCE</span>
            <strong>{sourceAccount ? sourceAccount.email : 'Not connected'}</strong>
          </div>

          <div className="hero-bridge__rail" aria-hidden="true">
            <span className="hero-bridge__arrow"><ArrowDown size={18} /></span>
          </div>

          <div className="hero-bridge__column hero-bridge__column--center">
            <span className="mono">MIGRATION</span>
            <strong>Workspace authorization</strong>
          </div>

          <div className="hero-bridge__rail" aria-hidden="true">
            <span className="hero-bridge__arrow"><ArrowDown size={18} /></span>
          </div>

          <div className="hero-bridge__column">
            <span className="mono">DESTINATION</span>
            <strong>{destAccount ? destAccount.email : 'Not connected'}</strong>
          </div>
        </div>
      </section>

      <section className="content-grid content-grid--two">
        {accountCard('source', sourceAccount, sourceLifetime, 'blue')}
        {accountCard('destination', destAccount, destLifetime, 'green')}
      </section>

      <ConfirmDialog
        open={!!confirmRole}
        title={`Disconnect ${confirmRole === 'source' ? 'Account A' : 'Account B'}?`}
        description="This only disconnects the current workspace account."
        confirmLabel="Disconnect"
        destructive
        onCancel={() => setConfirmRole(null)}
        onConfirm={() => disconnectAccount(confirmRole)}
      />
    </div>
  );
}
