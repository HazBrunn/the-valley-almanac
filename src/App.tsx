import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { StoreProvider, useStore } from './state/store';
import { ToastProvider } from './ui/common';
import { TodayIcon, PeopleIcon, FishNavIcon, CalendarIcon, JournalIcon, SearchIcon, MenuIcon, MapIcon, BackIcon, SeasonDeco } from './ui/icons';
import { UpdatePrompt } from './ui/UpdatePrompt';
import Today from './pages/Today';

const People = lazy(() => import('./pages/People'));
const Villager = lazy(() => import('./pages/Villager'));
const FishPages = lazy(() => import('./pages/Fish'));
const FishDetail = lazy(() => import('./pages/FishDetail'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Journal = lazy(() => import('./pages/Journal'));
const MapPage = lazy(() => import('./pages/MapPage'));
const Reference = lazy(() => import('./pages/Reference'));
const Settings = lazy(() => import('./pages/Settings'));
const Search = lazy(() => import('./pages/Search'));
const Welcome = lazy(() => import('./pages/Welcome'));

const NAV = [
  { to: '/', label: 'Today', Icon: TodayIcon, match: (p: string) => p === '/' },
  { to: '/people', label: 'People', Icon: PeopleIcon, match: (p: string) => p.startsWith('/people') },
  { to: '/fish', label: 'Fish', Icon: FishNavIcon, match: (p: string) => p.startsWith('/fish') },
  { to: '/calendar', label: 'Calendar', Icon: CalendarIcon, match: (p: string) => p.startsWith('/calendar') },
  { to: '/journal', label: 'Journal', Icon: JournalIcon, match: (p: string) => p.startsWith('/journal') },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Today'],
  [/^\/people/, 'People'],
  [/^\/fish/, 'Fishing'],
  [/^\/calendar/, 'Calendar'],
  [/^\/journal/, 'Journal'],
  [/^\/map/, 'Valley Map'],
  [/^\/shops/, 'Shops & Merchants'],
  [/^\/crops/, 'Crop Planner'],
  [/^\/forage/, 'Foraging'],
  [/^\/recipes/, 'Recipes & TV'],
  [/^\/museum/, 'Museum'],
  [/^\/settings/, 'Settings'],
  [/^\/about/, 'About'],
  [/^\/search/, 'Search'],
  [/^\/welcome/, 'Welcome'],
];

function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { ctx, ready, profile } = useStore();
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'The Valley Almanac';
  const topLevel = NAV.some((n) => n.to === pathname) || pathname === '/';

  useEffect(() => {
    document.documentElement.dataset.season = ctx.date.season;
  }, [ctx.date.season]);
  useEffect(() => {
    document.title = title === 'Today' ? 'The Valley Almanac' : `${title} · The Valley Almanac`;
  }, [title]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    if (ready && !profile.onboarded && pathname !== '/welcome') navigate('/welcome', { replace: true });
  }, [ready, profile.onboarded, pathname, navigate]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <SeasonDeco season={ctx.date.season} />
        <div className="header-inner">
          {!topLevel ? (
            <button type="button" className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Back">
              <BackIcon />
            </button>
          ) : (
            <Link to="/" className="brand" aria-label="The Valley Almanac home">
              The Valley
              <br />
              Almanac
            </Link>
          )}
          <h1 className="sign page-title grow" style={{ justifyContent: 'center' }}>
            {title}
          </h1>
          <Link to="/map" className="icon-btn" aria-label="Valley map">
            <MapIcon />
          </Link>
          <Link to="/search" className="icon-btn" aria-label="Search">
            <SearchIcon />
          </Link>
          <Link to="/settings" className="icon-btn" aria-label="Menu and settings">
            <MenuIcon />
          </Link>
        </div>
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        {ready ? children : <p className="empty">Opening your almanac…</p>}
      </main>
      <nav className="bottom-nav" aria-label="Main">
        {NAV.map(({ to, label, Icon, match }) => (
          <NavLink key={to} to={to} end={to === '/'} className={match(pathname) ? 'active' : undefined} aria-current={match(pathname) ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <UpdatePrompt />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <StoreProvider>
        <ToastProvider>
          <Shell>
            <Suspense fallback={<p className="empty">Turning the page…</p>}>
              <Routes>
                <Route path="/" element={<Today />} />
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/people" element={<People />} />
                <Route path="/people/:id" element={<Villager />} />
                <Route path="/fish" element={<FishPages view="list" />} />
                <Route path="/fish/timeline" element={<FishPages view="timeline" />} />
                <Route path="/fish/locations" element={<FishPages view="locations" />} />
                <Route path="/fish/:id" element={<FishDetail />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/journal" element={<Journal section="watch" />} />
                <Route path="/journal/collections" element={<Journal section="fish" />} />
                <Route path="/journal/bundles" element={<Journal section="bundles" />} />
                <Route path="/journal/museum" element={<Journal section="museum" />} />
                <Route path="/journal/recipes" element={<Journal section="recipes" />} />
                <Route path="/journal/notes" element={<Journal section="notes" />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/shops" element={<Reference section="shops" />} />
                <Route path="/crops" element={<Reference section="crops" />} />
                <Route path="/forage" element={<Reference section="forage" />} />
                <Route path="/recipes" element={<Reference section="recipes" />} />
                <Route path="/search" element={<Search />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/about" element={<Settings aboutOnly />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Shell>
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  );
}
