import React, { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { DriveStudio } from './pages/DriveStudio';
import { PhotosStudio } from './pages/PhotosStudio';
import { Jobs } from './pages/Jobs';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { BrandLogo, PageHeader, SectionHeader, StatusBadge, EmptyState, ProgressBar, PRODUCT_NAME, CONTACT_EMAIL } from './components/ui';
import { Badge } from './components/Badge';
import { HardDrive, Image as ImageIcon, ShieldCheck, History as HistoryIcon, Settings as SettingsIcon, HelpCircle, Info, Menu, X, ArrowRight, LayoutDashboard, Users, Sparkles } from 'lucide-react';

const ROUTES = [
  { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/connect', label: 'Accounts', icon: Users },
  { path: '/drive', label: 'Drive', icon: HardDrive },
  { path: '/photos', label: 'Photos', icon: ImageIcon },
  { path: '/migration', label: 'Migration', icon: ArrowRight },
  { path: '/history', label: 'History', icon: HistoryIcon },
  { path: '/security', label: 'Security', icon: ShieldCheck },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
  { path: '/help', label: 'Help', icon: HelpCircle },
  { path: '/about', label: 'About', icon: Info }
];

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function usePathname() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname));
  useEffect(() => {
    const onPop = () => setPathname(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (to) => {
    const next = normalizePath(to);
    if (next === normalizePath(window.location.pathname)) return;
    window.history.pushState({}, '', next);
    setPathname(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return [pathname, navigate];
}

function NavButton({ path, label, icon: Icon, pathname, navigate, mobile = false, onSelect }) {
  const active = pathname === path;
  return (
    <button
      className={`${mobile ? 'mobile-nav__item' : 'nav-link'} ${active ? 'active' : ''}`}
      onClick={() => {
        if (onSelect) onSelect();
        navigate(path);
      }}
    >
      <span className="nav-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span>{label}</span>
    </button>
  );
}

function Shell({ pathname, navigate, children }) {
  const { sourceAccount, destAccount, sseConnected } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeLabel = useMemo(() => ROUTES.find((r) => r.path === pathname)?.label || 'Landing', [pathname]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="site-header">
        <div className="site-header__inner">
          <button className="brand" onClick={() => navigate('/')}>
            <BrandLogo variant="dark" compact={true} />
          </button>

          <nav className="desktop-nav" aria-label="Primary">
            {ROUTES.map((route) => (
              <NavButton key={route.path} {...route} pathname={pathname} navigate={navigate} />
            ))}
          </nav>

          <div className="header-status">
            <StatusBadge tone={sseConnected ? 'green' : 'amber'} mono>{sseConnected ? 'Live' : 'Offline'}</StatusBadge>
            <StatusBadge tone={sourceAccount && destAccount ? 'green' : 'amber'} mono>
              {sourceAccount && destAccount ? 'Accounts ready' : 'Setup required'}
            </StatusBadge>
            <button className="mobile-menu-button" onClick={() => setMenuOpen((v) => !v)} aria-label="Open navigation">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="mobile-nav">
            {ROUTES.map((route) => (
              <NavButton key={route.path} {...route} pathname={pathname} navigate={navigate} mobile onSelect={() => setMenuOpen(false)} />
            ))}
          </div>
        )}
      </header>

      <main id="content" className="site-main">
        {children}
      </main>

      <footer className="site-footer">
        <div className="site-footer__grid">
          <div>
            <BrandLogo variant="dark" />
            <p className="footer-copy">Memories are precious. Your Drive usage shouldn't decide how many memories live.</p>
            <p className="mono footer-note">LiveEver · Digital lineages, unbroken</p>
          </div>
          <div>
            <h4>Product</h4>
            <button onClick={() => navigate('/help')}>How it works</button>
            <button onClick={() => navigate('/drive')}>Drive</button>
            <button onClick={() => navigate('/photos')}>Photos</button>
            <button onClick={() => navigate('/migration')}>Migration</button>
            <button onClick={() => navigate('/security')}>Security</button>
          </div>
          <div>
            <h4>Company</h4>
            <button onClick={() => navigate('/about')}>About</button>
            <button onClick={() => navigate('/contact')}>Contact</button>
            <h4 style={{ marginTop: 18 }}>Resources</h4>
            <button onClick={() => navigate('/help')}>Help</button>
            <button onClick={() => navigate('/faq')}>FAQ</button>
          </div>
          <div>
            <h4>Legal</h4>
            <button onClick={() => navigate('/privacy')}>Privacy</button>
            <button onClick={() => navigate('/terms')}>Terms</button>
            <div className="footer-contact">
              <h4 style={{ marginTop: 18 }}>Contact</h4>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LandingPage({ navigate }) {
  return (
    <div className="landing">
      <section className="hero-grid hero-grid--landing">
        <div className="hero-copy">
          <div className="eyebrow">YOUR DIGITAL LIFE, ALWAYS WITH YOU</div>
          <div className="hero-brand">
            <BrandLogo variant="dark" />
          </div>
          <h1>Memories are precious. Your Drive usage shouldn't decide how many memories live.</h1>
          <p className="lede">
            LiveEver helps you move the files and memories that matter from one account to another — simply, securely,
            and without leaving your digital life behind.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/app')}>Start your migration</button>
            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/help')}>See how it works</button>
          </div>
          <div className="trust-strip">
            <div className="trust-chip"><span>Source</span><strong>Account A</strong></div>
            <div className="trust-chip"><span>Destination</span><strong>Account B</strong></div>
            <div className="trust-chip"><span>Visibility</span><strong>Progress and history</strong></div>
            <div className="trust-chip"><span>Approach</span><strong>Private by design</strong></div>
          </div>
        </div>

        <div className="hero-visual card-surface">
          <div className="preview-stack">
            <div className="preview-card preview-card--large">
              <div className="preview-card__eyebrow">LiveEver control center</div>
              <div className="preview-card__title">Account A → Account B</div>
              <ProgressBar value={68} label="Current migration" detail="2,148 / 3,140 items" />
              <div className="preview-meta">
                <StatusBadge tone="green" mono>Drive synced</StatusBadge>
                <StatusBadge tone="amber" mono>Photos queued</StatusBadge>
              </div>
            </div>
            <div className="preview-card preview-card--small">
              <div className="preview-card__title">Recent activity</div>
              <p>Files discovered, selected, migrated, and verified.</p>
            </div>
          </div>
        </div>
      </section>

      <SectionHeader number="01" title="Why it exists" description="A change in accounts should not force a change in your memories." />
      <section className="content-grid">
        <article className="info-card"><h3>Account changes are normal</h3><p>People switch jobs, storage plans, and personal emails. The product exists to preserve continuity.</p></article>
        <article className="info-card"><h3>Storage limits move</h3><p>New accounts often have different limits. Important files and photos should not be trapped by quota changes.</p></article>
        <article className="info-card"><h3>You stay in control</h3><p>Account selection, migration scope, and progress tracking are explicit rather than automatic.</p></article>
      </section>

      <SectionHeader number="02" title="How it works" description="Connect, select, migrate, verify." />
      <section className="control-steps">
        {[
          ['Connect', 'Authorize the source and destination accounts.'],
          ['Select', 'Choose the Drive folders or Photos items you want to move.'],
          ['Migrate', 'Start the job and monitor it in real time.'],
          ['Verify', 'Review history and completion state afterward.']
        ].map(([title, desc], idx) => (
          <div key={title} className="step-card">
            <span className="mono step-number">{String(idx + 1).padStart(2, '0')}</span>
            <h3>{title}</h3>
            <p>{desc}</p>
          </div>
        ))}
      </section>

      <SectionHeader number="03" title="Drive and Photos" description="The app focuses on the content that matters most." />
      <section className="feature-grid">
        <article className="feature-card">
          <div className="feature-top"><HardDrive size={18} /><span>Drive migration</span></div>
          <p>Folder hierarchy, file selection, transfer progress, and destination tracking in one workflow.</p>
        </article>
        <article className="feature-card">
          <div className="feature-top"><ImageIcon size={18} /><span>Photos migration</span></div>
          <p>Picker-based selection for Google Photos media with session-aware migration tracking.</p>
        </article>
        <article className="feature-card">
          <div className="feature-top"><ShieldCheck size={18} /><span>Privacy and security</span></div>
          <p>OAuth-only account connection, no password collection, and workspace-scoped records.</p>
        </article>
      </section>

      <SectionHeader number="04" title="Migration tracking" description="See progress, active jobs, completed jobs, and history." />
      <section className="trust-grid">
        <article className="info-card"><h3>Progress</h3><p>Clear job-level progress and item-by-item visibility.</p></article>
        <article className="info-card"><h3>Jobs</h3><p>Pause, resume, retry, and inspect active migrations.</p></article>
        <article className="info-card"><h3>History</h3><p>Completed and partial migrations remain visible for later review.</p></article>
      </section>

      <SectionHeader number="05" title="Trust" description="Honest privacy language without unsupported claims." />
      <section className="content-grid">
        <article className="info-card"><h3>What we do</h3><p>We connect to Google accounts you authorize and move supported Drive and Photos content between them.</p></article>
        <article className="info-card"><h3>What we do not claim</h3><p>No invented certifications, no zero-knowledge claims, and no unsupported security promises.</p></article>
        <article className="info-card"><h3>What you can review</h3><p>Connections, job state, migration history, and status updates are visible inside the app.</p></article>
      </section>

      <section className="final-cta card-surface">
        <div className="eyebrow">Ready when you are</div>
        <h2>Your account can change. Your memories shouldn't have to.</h2>
        <p>Start with a calm, explicit workflow for Drive and Photos migration.</p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/app')}>Start your migration</button>
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/about')}>About the product</button>
        </div>
      </section>
    </div>
  );
}

function StaticPage({ eyebrow, title, description, children }) {
  return (
    <div className="page-shell">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="content-stack">{children}</div>
    </div>
  );
}

function RouteContent({ pathname, navigate }) {
  if (pathname === '/') return <LandingPage navigate={navigate} />;
  if (pathname === '/app') return <div className="page-shell"><Dashboard setActiveTab={navigate} /></div>;
  if (pathname === '/connect') return <div className="page-shell"><Accounts /></div>;
  if (pathname === '/drive') return <div className="page-shell"><DriveStudio setActiveTab={navigate} /></div>;
  if (pathname === '/photos') return <div className="page-shell"><PhotosStudio setActiveTab={navigate} /></div>;
  if (pathname === '/migration') return <div className="page-shell"><Jobs /></div>;
  if (pathname === '/history') return <div className="page-shell"><History /></div>;
  if (pathname === '/settings') return <div className="page-shell"><Settings /></div>;

  if (pathname === '/security') {
    return (
      <StaticPage eyebrow="Security" title="Security and privacy" description="A truthful summary of the app's current security model.">
        <section className="content-grid">
          <article className="info-card"><h3>Authentication</h3><p>Google OAuth is used for account authorization. The app does not ask for Google passwords.</p></article>
          <article className="info-card"><h3>Workspace scope</h3><p>Migration records and jobs are scoped to the current workspace, and session state stays isolated.</p></article>
          <article className="info-card"><h3>Data handling</h3><p>Drive migration and Photos migration follow the capabilities already implemented in the backend.</p></article>
        </section>
      </StaticPage>
    );
  }

  if (pathname === '/help' || pathname === '/faq') {
    return (
      <StaticPage eyebrow="Help" title="Help and FAQ" description="Useful answers for connecting accounts, choosing content, and tracking migration progress.">
        <section className="faq-grid">
          {[
            ['How do I connect accounts?', 'Open Accounts, connect Account A as the source and Account B as the destination, then return to Drive or Photos.'],
            ['What can be migrated?', 'Supported Drive content and Photos items that are selected through the existing app flows.'],
            ['How do I see progress?', 'Open Migration or History to inspect active jobs, status, and item-level updates.'],
            ['What if something fails?', 'Retry, resume, or recover using the controls already provided by the app.']
          ].map(([q, a]) => (
            <details key={q} className="faq-item">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </StaticPage>
    );
  }

  if (pathname === '/about') {
    return (
      <StaticPage eyebrow="About" title="About" description="Digital accounts change. Digital memories shouldn't have to disappear with them.">
        <section className="content-grid">
          <article className="info-card"><h3>Philosophy</h3><p>The product is built around continuity, preservation, and a gentle migration experience.</p></article>
          <article className="info-card"><h3>Scope</h3><p>It focuses on Google Drive and Google Photos content using the existing migration system already in the codebase.</p></article>
          <article className="info-card"><h3>Identity</h3><p>The brand is independent and intentionally avoids Google-like styling or wording.</p></article>
        </section>
      </StaticPage>
    );
  }

  if (pathname === '/contact') {
    return (
      <StaticPage eyebrow="Contact" title="Contact" description="Reach the team through the configured contact address.">
        <article className="info-card">
          <h3>Email</h3>
          <p><a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </article>
      </StaticPage>
    );
  }

  if (pathname === '/privacy') {
    return (
      <StaticPage eyebrow="Legal" title="Privacy" description="A placeholder policy page for the beta environment.">
        <article className="info-card">
          <h3>Privacy notice</h3>
          <p>This deployment keeps migration data needed for the current workspace. Replace this placeholder with the final legal policy before production.</p>
        </article>
      </StaticPage>
    );
  }

  if (pathname === '/terms') {
    return (
      <StaticPage eyebrow="Legal" title="Terms" description="A placeholder terms page for the beta environment.">
        <article className="info-card">
          <h3>Terms</h3>
          <p>Use of this beta is subject to change. Replace this placeholder with the final terms before production.</p>
        </article>
      </StaticPage>
    );
  }

  return (
    <div className="page-shell">
      <div className="not-found card-surface">
        <div className="eyebrow">404</div>
        <h1>This page doesn't exist.</h1>
        <p>Looks like this destination wasn't found.</p>
        <button className="btn btn-primary" onClick={() => navigate('/app')}>Return to dashboard</button>
      </div>
    </div>
  );
}

export function App() {
  const [pathname, navigate] = usePathname();
  useEffect(() => {
    const titleMap = {
      '/': 'LiveEver - Digital lineages, unbroken',
      '/app': 'LiveEver - Dashboard',
      '/connect': 'LiveEver - Accounts',
      '/drive': 'LiveEver - Drive',
      '/photos': 'LiveEver - Photos',
      '/migration': 'LiveEver - Migration',
      '/history': 'LiveEver - History',
      '/security': 'LiveEver - Security',
      '/settings': 'LiveEver - Settings',
      '/help': 'LiveEver - Help',
      '/about': 'LiveEver - About',
      '/contact': 'LiveEver - Contact',
      '/privacy': 'LiveEver - Privacy',
      '/terms': 'LiveEver - Terms'
    };
    document.title = titleMap[pathname] || PRODUCT_NAME;
  }, [pathname]);

  return (
    <AppProvider>
      <Shell pathname={pathname} navigate={navigate}>
        <RouteContent pathname={pathname} navigate={navigate} />
      </Shell>
    </AppProvider>
  );
}

export default App;
