import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import { fetchCurrentUser } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    fetchCurrentUser()
      .then((data) => {
        if (!isCancelled) {
          setUser(data.user);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsCheckingAuth(false);
        }
      });

    const handleUnauthorized = () => {
      if (!isCancelled) {
        setUser(null);
      }
    };

    window.addEventListener('habitflow:unauthorized', handleUnauthorized);
    return () => {
      isCancelled = true;
      window.removeEventListener('habitflow:unauthorized', handleUnauthorized);
    };
  }, []);

  return (
    <ErrorBoundary>
      <OfflineBanner />
      {isCheckingAuth ? (
        <div
          data-testid="auth-loading-screen"
          className="min-h-screen bg-[#F7F9F8] flex flex-col items-center justify-center gap-3"
        >
          <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            <span>Loading HabitFlow...</span>
          </div>
        </div>
      ) : user ? (
        <DashboardPage
          key={user.id}
          user={user}
          onUserUpdated={setUser}
          onSignedOut={() => setUser(null)}
        />
      ) : (
        <AuthPage onAuthenticated={setUser} />
      )}
    </ErrorBoundary>
  );
}
