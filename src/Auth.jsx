import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
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
  const [businessSettings, setBusinessSettings] = useState({
    businessName: 'Recess Roster',
    logoUrl: ''
  });

  // Load business settings (public, no auth required)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('business_name, logo_url')
          .limit(1)
          .single();

        if (data && !error) {
          setBusinessSettings({
            businessName: data.business_name || 'Recess Roster',
            logoUrl: data.logo_url || ''
          });
        }
      } catch (error) {
        console.log('Could not load public settings, using defaults');
      }
    };

    loadSettings();
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
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-modal p-8 w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          {businessSettings.logoUrl ? (
            <div className="relative">
              <img
                src={businessSettings.logoUrl}
                alt={`${businessSettings.businessName} Logo`}
                className="h-16 w-16 mx-auto mb-4 object-contain rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallback = e.target.nextElementSibling;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div style={{ display: 'none' }} className="bg-brand-500 w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="bg-brand-500 w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          )}

          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            {businessSettings.businessName}
          </h1>
          <p className="text-sm text-gray-500">Staff Management System</p>
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
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Secure authentication powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error signing out:', error);
};
