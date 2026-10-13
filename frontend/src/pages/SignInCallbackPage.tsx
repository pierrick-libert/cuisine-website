import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { exchangeCodeForTokens } from '../services/auth.js';

/** Handles the Hosted UI's OAuth2 redirect back to this app (contracts/auth.md step 3-4). */
export function SignInCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      return;
    }
    exchangeCodeForTokens(code)
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'));
  }, [searchParams]);

  if (status === 'done') return <Navigate to="/" replace />;
  if (status === 'error') return <p style={{ padding: 24, color: 'var(--color-danger)' }}>Sign-in failed. Please try again.</p>;
  return <p style={{ padding: 24, color: 'var(--color-text-muted)' }}>Signing in…</p>;
}
