import React from 'react';
import { useAuth, Auth } from './Auth';
import RosterApp from './roster-app';
import PublicScheduleView from './PublicScheduleView';

// Resolve public schedule route before auth: /s/<token>
const publicMatch = window.location.pathname.match(/^\/s\/([^/]+)/);
const PUBLIC_TOKEN = publicMatch ? publicMatch[1] : null;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 font-mono max-w-3xl mx-auto">
          <h1 className="text-red-600 text-2xl font-bold mb-4">Something went wrong</h1>
          <pre className="bg-red-50 p-5 rounded-lg overflow-auto whitespace-pre-wrap text-sm">
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Recess Roster...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <Auth />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <RosterApp />
    </ErrorBoundary>
  );
}

function App() {
  if (PUBLIC_TOKEN) {
    return <PublicScheduleView token={PUBLIC_TOKEN} />;
  }
  return <AuthenticatedApp />;
}

export default App;
