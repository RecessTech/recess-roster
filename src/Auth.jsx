import React, { useState, useEffect } from 'react';
import { CalendarDays, Clock, BarChart3 } from 'lucide-react';
import { supabase } from './supabaseClient';

const LOGO_URL = 'https://i.postimg.cc/76YSLjdw/rshift-on-cream.jpg';

const FEATURES = [
  { icon: CalendarDays, text: 'Build the week\'s roster in minutes, not hours' },
  { icon: Clock, text: 'Timesheets and labour cost, calculated automatically' },
  { icon: BarChart3, text: 'Live sales, costs and P&L built right in' },
];

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;
    const stopLoading = (session) => {
      if (settled) return;
      settled = true;
      setUser(session?.user ?? null);
      setLoading(false);
    };

    // supabase-js serializes auth calls behind a cross-tab lock, which can
    // be left stuck (e.g. by a crashed/closed tab) and never release --
    // getSession() then hangs forever and wedges the app on the loading
    // screen. Fall back to the signed-out view rather than hang; if the
    // lock does clear later, onAuthStateChange below still updates user.
    const timeoutId = setTimeout(() => stopLoading(null), 8000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => stopLoading(session))
      .catch(() => stopLoading(null))
      .finally(() => clearTimeout(timeoutId));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      stopLoading(session);
      setUser(session?.user ?? null);
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
};

export const Auth = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // The signed-in app picks its own data-theme per active module (see
  // roster-app.jsx) -- R-Shift's is 'blue'. Nothing has set that attribute
  // yet at the sign-in screen, so it falls back to the root/orange default
  // without this. Sets R-Shift's colourway explicitly rather than inheriting
  // whichever theme happened to be active last.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'blue');
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        setMessage('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel -- hidden below lg, where the compact header inside the
          form panel carries the logo/wordmark instead. */}
      <div
        className="hidden lg:flex lg:w-[44%] xl:w-[40%] flex-col justify-between p-12 text-white"
        style={{ background: 'linear-gradient(160deg, var(--sb-bg), var(--primary-dk))' }}
      >
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-elevated shrink-0">
          <img src={LOGO_URL} alt="R-Shift" className="w-full h-full object-cover" />
        </div>

        <div className="max-w-sm">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">R-Shift</h1>
          <p className="text-base text-white/80 mb-10 leading-relaxed">
            Staff scheduling, timesheets and rostering -- built for cafes and hospitality teams.
          </p>
          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/15">
                  <Icon size={16} />
                </div>
                <p className="text-sm text-white/90 leading-relaxed pt-1.5">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/50">© {new Date().getFullYear()} R-Shift</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--app-bg, #F5F5F5)' }}>
        <div className="w-full max-w-sm animate-fade-in">
          {/* Compact header for the brand panel's mobile/tablet equivalent */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-elevated mx-auto mb-4">
              <img src={LOGO_URL} alt="R-Shift" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">R-Shift</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-modal p-8">
            <div className="hidden lg:block mb-6">
              <h2 className="text-xl font-bold text-gray-900">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
              <p className="text-sm text-gray-500 mt-1">{isSignUp ? 'Set up sign-in for R-Shift.' : 'Sign in to R-Shift to continue.'}</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {message}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-base"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-base"
                  placeholder="Enter password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5"
              >
                {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-medium"
                style={{ color: 'var(--primary)' }}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                Secure sign-in
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error signing out:', error);
};
