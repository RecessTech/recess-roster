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
        // Try to get any public settings (you may need to adjust this query)
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
        // Silently fail - just use defaults
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          {/* Logo Display - shows custom logo if available, otherwise default icon */}
          {businessSettings.logoUrl ? (
            <div className="relative">
              <img 
                src={businessSettings.logoUrl} 
                alt={`${businessSettings.businessName} Logo`}
                className="h-20 w-20 mx-auto mb-4 object-contain"
                onError={(e) => {
                  // If logo fails to load, hide it and show default icon
                  e.target.style.display = 'none';
                  const fallback = e.target.nextElementSibling;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              {/* Fallback icon (hidden unless image fails) */}
              <div style={{ display: 'none' }} className="bg-gradient-to-br from-orange-500 to-orange-600 w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          )}
          
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent mb-2">
            {businessSettings.businessName}
          </h1>
          <p className="text-gray-600 text-sm">Staff Management System</p>
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-500 hover:to-orange-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
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