import React from 'react';
import { useAuth, Auth } from './Auth';
import RosterApp from './roster-app';
import PublicScheduleView from './PublicScheduleView';
import PublicRosterView from './PublicRosterView';
import PublicProductionView from './PublicProductionView';
import PublicTransferHubView from './PublicTransferHubView';
import PublicPrepListView from './PublicPrepListView';
import PublicStaffHubView from './PublicStaffHubView';
import PublicCateringView from './PublicCateringView';
import PublicBuildsView from './PublicBuildsView';
import PublicBaristaView from './PublicBaristaView';
import { ErrorBoundary } from './ErrorBoundary';

// Resolve public routes before auth: /s/<token> (one staff member's shifts),
// /r/<token> (the whole roster, read-only), /prod/<token> (the daily
// production plan, read-only), /transfers/<token> (Transfer Hub's
// open-requests dashboard, read-only), /prep/<token> (the Prep List --
// flag a prep component as running low, tick it off once prepped),
// /cater/<token> (the day's catering jobs, read-only), /builds/<token>
// (sandwich & toastie build guides, read-only), /barista/<token> (Coffee
// & Tea drinks guide, read-only), and /hub/<token> (a landing page linking
// out to the other read-only pages)
const publicMatch = window.location.pathname.match(/^\/s\/([^/]+)/);
const PUBLIC_TOKEN = publicMatch ? publicMatch[1] : null;

const publicRosterMatch = window.location.pathname.match(/^\/r\/([^/]+)/);
const PUBLIC_ROSTER_TOKEN = publicRosterMatch ? publicRosterMatch[1] : null;

const publicProductionMatch = window.location.pathname.match(/^\/prod\/([^/]+)/);
const PUBLIC_PRODUCTION_TOKEN = publicProductionMatch ? publicProductionMatch[1] : null;

const publicTransferMatch = window.location.pathname.match(/^\/transfers\/([^/]+)/);
const PUBLIC_TRANSFER_TOKEN = publicTransferMatch ? publicTransferMatch[1] : null;

const publicPrepListMatch = window.location.pathname.match(/^\/prep\/([^/]+)/);
const PUBLIC_PREP_LIST_TOKEN = publicPrepListMatch ? publicPrepListMatch[1] : null;

const publicCateringMatch = window.location.pathname.match(/^\/cater\/([^/]+)/);
const PUBLIC_CATERING_TOKEN = publicCateringMatch ? publicCateringMatch[1] : null;

const publicBuildsMatch = window.location.pathname.match(/^\/builds\/([^/]+)/);
const PUBLIC_BUILDS_TOKEN = publicBuildsMatch ? publicBuildsMatch[1] : null;

const publicBaristaMatch = window.location.pathname.match(/^\/barista\/([^/]+)/);
const PUBLIC_BARISTA_TOKEN = publicBaristaMatch ? publicBaristaMatch[1] : null;

const publicHubMatch = window.location.pathname.match(/^\/hub\/([^/]+)/);
const PUBLIC_HUB_TOKEN = publicHubMatch ? publicHubMatch[1] : null;

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
  if (PUBLIC_PREP_LIST_TOKEN) {
    return <PublicPrepListView token={PUBLIC_PREP_LIST_TOKEN} />;
  }
  if (PUBLIC_CATERING_TOKEN) {
    return <PublicCateringView token={PUBLIC_CATERING_TOKEN} />;
  }
  if (PUBLIC_BUILDS_TOKEN) {
    return <PublicBuildsView token={PUBLIC_BUILDS_TOKEN} />;
  }
  if (PUBLIC_BARISTA_TOKEN) {
    return <PublicBaristaView token={PUBLIC_BARISTA_TOKEN} />;
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
