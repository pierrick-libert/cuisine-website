import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { signOut } from '../services/auth.js';

const navItemStyle = (active: boolean): React.CSSProperties => ({
  padding: '9px 10px',
  borderRadius: 7,
  fontSize: 13.5,
  fontWeight: active ? 600 : 500,
  background: active ? 'var(--color-sidebar-active-bg)' : 'transparent',
  color: 'inherit',
  opacity: active ? 1 : 0.7,
});

/** The backoffice's persistent sidebar + content shell (mockups/Backoffice.dc.html). */
export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const onRecipes = pathname === '/' || pathname.startsWith('/recipes');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div
        style={{
          width: 200,
          flexShrink: 0,
          background: 'var(--color-sidebar-bg)',
          color: 'var(--color-sidebar-text)',
          padding: '22px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, padding: '0 8px 20px' }}>
          Pierrick&rsquo;s Sunday Kitchen <span style={{ opacity: 0.55, fontWeight: 500 }}>admin</span>
        </div>
        <Link to="/" style={navItemStyle(onRecipes)}>
          Recipes
        </Link>
        {/* Categories and Media aren't separate pages yet — shown as planned, not broken links. */}
        <span style={{ ...navItemStyle(false), cursor: 'default', fontStyle: 'italic' }}>Categories (soon)</span>
        <span style={{ ...navItemStyle(false), cursor: 'default', fontStyle: 'italic' }}>Media (soon)</span>
        <button
          type="button"
          onClick={() => void signOut()}
          style={{
            marginTop: 'auto',
            padding: '10px',
            borderRadius: 8,
            background: 'var(--color-sidebar-footer-bg)',
            color: 'inherit',
            opacity: 0.85,
            fontSize: 12.5,
            fontWeight: 600,
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
