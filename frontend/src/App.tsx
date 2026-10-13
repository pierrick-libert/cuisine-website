import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout.js';
import { RecipeListPage } from './pages/RecipeListPage.js';
import { RecipeEditorPage } from './pages/RecipeEditorPage.js';
import { SignInCallbackPage } from './pages/SignInCallbackPage.js';
import { isSignedIn, redirectToSignIn } from './services/auth.js';

/** Redirects to the Cognito Hosted UI before rendering any backoffice route (FR-003). */
function RequireAuth({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!isSignedIn()) void redirectToSignIn();
  }, []);

  return isSignedIn() ? <Layout>{children}</Layout> : null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin-callback" element={<SignInCallbackPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <RecipeListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/recipes/new"
          element={
            <RequireAuth>
              <RecipeEditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/recipes/:id"
          element={
            <RequireAuth>
              <RecipeEditorPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
