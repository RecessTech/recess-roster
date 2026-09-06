import React from 'react';
import { useAuth, Auth } from './Auth';
import RosterApp from './roster-app';
import PublicScheduleView from './PublicScheduleView';
import PublicRosterView from './PublicRosterView';
import PublicProductionView from './PublicProductionView';
import PublicTransferHubView from './PublicTransferHubView';
import PublicStaffHubView from './PublicStaffHubView';

// Resolve public routes before auth: /s/<token> (one staff member's shifts),
// /r/<token> (the whole roster, read-only), /prod/<token> (the daily
// production plan, read-only), /transfers/<token> (Transfer Hub's
// open-requests dashboard, read-only), and /hub/<token> (a landing page
// linking out to the other read-only pages, read-only)
const publicMatch = window.location.pathname.match(/^\/s\/([^/]+)/);
const PUBLIC_TOKEN = publicMatch ? publicMatch[1] : null;

const publicRosterMatch = window.location.pathname.match(/^\/r\/([^/]+)/);
const PUBLIC_ROSTER_TOKEN = publicRosterMatch ? publicRosterMatch[1] : null;

const publicProductionMatch = window.location.pathname.match(/^\/prod\/([^/]+)/);
const PUBLIC_PRODUCTION_TOKEN = publicProductionMatch ? publicProductionMatch[1] : null;

const publicTransferMatch = window.location.pathname.match(/^\/transfers\/([^/]+)/);
const PUBLIC_TRANSFER_TOKEN = publicTransferMatch ? publicTransferMatch[1] : null;

const publicHubMatch = window.location.pathname.match(/^\/hub\/([^/]+)/);
const PUBLIC_HUB_TOKEN = publicHubMatch ? publicHubMatch[1] : null;

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
  if (PUBLIC_ROSTER_TOKEN) {
    return <PublicRosterView token={PUBLIC_ROSTER_TOKEN} />;
  }
  if (PUBLIC_PRODUCTION_TOKEN) {
    return <PublicProductionView token={PUBLIC_PRODUCTION_TOKEN} />;
  }
  if (PUBLIC_TRANSFER_TOKEN) {
    return <PublicTransferHubView token={PUBLIC_TRANSFER_TOKEN} />;
  }
  if (PUBLIC_HUB_TOKEN) {
    return <PublicStaffHubView token={PUBLIC_HUB_TOKEN} />;
  }
  if (PUBLIC_TOKEN) {
    return <PublicScheduleView token={PUBLIC_TOKEN} />;
  }
  return <AuthenticatedApp />;
}

export default App;
