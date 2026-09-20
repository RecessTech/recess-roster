import React, { useState, useEffect } from 'react';
import { Quote } from 'lucide-react';
import { supabase } from './supabaseClient';

const LOGO_URL = 'https://i.postimg.cc/76YSLjdw/rshift-on-cream.jpg';

// Real, verifiably-attributed sandwich quotes only -- no invented lines
// pinned to real names. One picked at random per mount, so it varies
// across sign-ins without needing any server-side state.
const SANDWICH_QUOTES = [
  { quote: "Too few people understand a really good sandwich.", author: 'James Beard' },
  { quote: "A sandwich and a cup of coffee, and then off to violin-land, where all is sweetness and delicacy and harmony.", author: 'Arthur Conan Doyle' },
  { quote: "Sandwiches are wonderful. You don't need a spoon or a plate!", author: 'Paul Lynde' },
  { quote: 'My favorite sandwich is peanut butter, baloney, cheddar cheese, lettuce, and mayonnaise on toasted bread with catsup on the side.', author: 'Hubert H. Humphrey' },
  { quote: 'A bacon sandwich should always be slightly too big, never elegant.', author: 'Nigel Slater' },
  { quote: 'When I was a boy there were only three kinds of sandwiches in common use -- the ham, the chicken and the Swiss cheese.', author: 'H. L. Mencken' },
  { quote: 'Do not make a stingy sandwich, pile the cold cuts high. Customers should see salami coming through the rye.', author: 'Allan Sherman' },
  { quote: 'I feel faint -- give me a ham sandwich!', author: 'Lewis Carroll' },
  { quote: "A man's social rank is determined by the amount of bread he eats in a sandwich.", author: 'F. Scott Fitzgerald' },
  { quote: 'A hungry man is more interested in four sandwiches than four freedoms.', author: 'Henry Cabot Lodge Jr.' },
  { quote: "Have you got frog's legs? Yes. Well hop into the kitchen and get me a cheese sandwich.", author: 'Tommy Cooper' },
  { quote: 'You look at it, but nothing happens, so then you look for someplace to get a sandwich.', author: 'Danny DeVito' },
  { quote: 'A peanut butter and jelly sandwich is better than bad sex.', author: 'Billy Joel' },
  { quote: 'Maybe hell is just having to listen to our grandparents breathe through their noses when they\'re eating sandwiches.', author: 'Jim Carrey' },
  { quote: "If what I have to do is share a sandwich to lift someone's spirits and put a smile on their face, the worst thing that happens is I go broke.", author: 'José Andrés' },
  { quote: 'Enjoy every sandwich.', author: 'Warren Zevon' },
  { quote: 'If they had a social gospel in the days of the prodigal son, somebody would have given him a bed and a sandwich and he never would have gone home.', author: 'Vance Havner' },
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
  // Picked once per mount (lazy initializer), not on every render -- a
  // fresh mount happens each time someone lands on this screen (sign out,
  // session expiry, a new tab), which is exactly when "cycling" should show.
  const [quote] = useState(() => SANDWICH_QUOTES[Math.floor(Math.random() * SANDWICH_QUOTES.length)]);

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
          <h1 className="text-4xl font-extrabold tracking-tight mb-8">R-Shift</h1>
          <Quote size={28} className="text-white/30 mb-3" />
          <p className="text-xl font-medium text-white/90 leading-relaxed mb-4">
            &ldquo;{quote.quote}&rdquo;
          </p>
          <p className="text-sm text-white/60">— {quote.author}</p>
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
