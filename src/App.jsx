import React from 'react';
import { useAuth, Auth } from './Auth';
import RosterApp from './roster-app';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Recess Roster...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <RosterApp />;
}

export default App;