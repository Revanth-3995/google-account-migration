import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Shield, History, Users, Lock, Database, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { Badge } from '../components/Badge';
import { PageHeader, SectionHeader, StatusBadge, EmptyState } from '../components/ui';

function SecurityCard({ icon: Icon, title, description, meta, tone = 'neutral' }) {
  return (
    <article className="info-card">
      <div className="feature-top">
        <Icon size={18} />
        <span>{title}</span>
      </div>
      <p>{description}</p>
      {meta ? <div style={{ marginTop: 10 }}><StatusBadge tone={tone} mono>{meta}</StatusBadge></div> : null}
    </article>
  );
}

export function Settings() {
  const { sourceAccount, destAccount, sourceLifetime, destLifetime, jobs, auditLogs } = useApp();

  const activeJobs = jobs.filter((j) => j.status === 'RUNNING').length;
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED' || j.status === 'COMPLETED_WITH_ERRORS').length;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Security & privacy"
        title="Security & Privacy"
        description="Review connected accounts, migration visibility, and the current privacy posture of this workspace."
      />

      <section className="content-grid">
        <SecurityCard
          icon={Users}
          title="Connected accounts"
          description="The workspace uses two explicitly connected Google accounts: source Account A and destination Account B."
          meta={`${sourceAccount ? 'Source connected' : 'Source not connected'} · ${destAccount ? 'Destination connected' : 'Destination not connected'}`}
          tone={sourceAccount && destAccount ? 'green' : 'amber'}
        />
        <SecurityCard
          icon={ShieldCheck}
          title="Authorization"
          description="Account access is based on Google OAuth consent already implemented in the app. Passwords are not requested by this interface."
          meta="OAuth-based access"
          tone="blue"
        />
        <SecurityCard
          icon={History}
          title="Migration visibility"
          description="Active jobs, completed jobs, and migration history remain visible in the workspace so you can review what moved."
          meta={`${activeJobs} active · ${completedJobs} completed`}
          tone="green"
        />
      </section>

      <SectionHeader
        number="01"
        title="Account status"
        description="These are the only connection details shown here. No raw client IDs, project IDs, secrets, API keys, or tokens are displayed."
      />

      <section className="content-grid content-grid--two">
        <article className="account-card card-surface">
          <div className="account-card__top">
            <div>
              <div className="eyebrow">SOURCE · Account A</div>
              <h3>Connected source account</h3>
            </div>
            <Badge type={sourceAccount ? 'COMPLETED' : 'READY'} text={sourceAccount ? 'Connected' : 'Not connected'} />
          </div>
          {sourceAccount ? (
            <div className="account-card__body">
              <div className="account-email">{sourceAccount.email}</div>
              <div className="account-scopes mono">{sourceAccount.scopes}</div>
              <div className="empty-inline">
                <Lock size={18} />
                <p>{sourceLifetime.remainingLabel}</p>
              </div>
            </div>
          ) : (
            <EmptyState title="Source account not connected." description="Connect Account A from the Accounts page to enable Drive and Photos migration." />
          )}
        </article>

        <article className="account-card card-surface">
          <div className="account-card__top">
            <div>
              <div className="eyebrow">DESTINATION · Account B</div>
              <h3>Connected destination account</h3>
            </div>
            <Badge type={destAccount ? 'COMPLETED' : 'READY'} text={destAccount ? 'Connected' : 'Not connected'} />
          </div>
          {destAccount ? (
            <div className="account-card__body">
              <div className="account-email">{destAccount.email}</div>
              <div className="account-scopes mono">{destAccount.scopes}</div>
              <div className="empty-inline">
                <Lock size={18} />
                <p>{destLifetime.remainingLabel}</p>
              </div>
            </div>
          ) : (
            <EmptyState title="Destination account not connected." description="Connect Account B from the Accounts page to receive migrated content." />
          )}
        </article>
      </section>

      <SectionHeader
        number="02"
        title="Privacy and data handling"
        description="Only truthful, implemented behavior is described here."
      />

      <section className="content-grid">
        <SecurityCard
          icon={Lock}
          title="Data handling"
          description="Migration data, job history, and audit events remain inside the workspace so the app can show progress and completion."
          meta="Workspace-scoped records"
          tone="neutral"
        />
        <SecurityCard
          icon={Database}
          title="Storage"
          description="The app stores operational records needed for migration and history. It does not expose the underlying database URL or other internal connection strings in the UI."
          meta="Operational storage only"
          tone="amber"
        />
        <SecurityCard
          icon={Shield}
          title="User controls"
          description="You can disconnect accounts from the Accounts page and review migration history from the History page."
          meta="Disconnect and review controls"
          tone="green"
        />
      </section>

      <SectionHeader
        number="03"
        title="Advanced diagnostics"
        description="Developer-oriented information stays out of the normal Settings surface."
      />

      <section className="content-grid">
        <article className="info-card">
          <div className="feature-top">
            <SettingsIcon size={18} />
            <span>Diagnostics policy</span>
          </div>
          <p>
            No raw client IDs, project IDs, API keys, secrets, access tokens, refresh tokens, database URLs, or session identifiers are shown to normal users.
          </p>
          <p style={{ marginTop: 10 }}>
            If you need debugging help, use the application logs or developer tools outside the user-facing Settings page.
          </p>
        </article>
        <article className="info-card">
          <div className="feature-top">
            <AlertTriangle size={18} />
            <span>What is intentionally hidden</span>
          </div>
          <p>
            OAuth Client ID, Google Cloud Project ID, API keys, client secrets, tokens, and backend connection strings remain in configuration and are not rendered here.
          </p>
          <p style={{ marginTop: 10 }}>
            This keeps the UI aligned with a consumer SaaS security page instead of a developer console.
          </p>
        </article>
      </section>
    </div>
  );
}
