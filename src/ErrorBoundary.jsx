import React from 'react';

// Scoped to wrap one section of the app (a tab, a view) so a crash there
// doesn't take down the whole app -- other tabs stay usable.
export class ErrorBoundary extends React.Component {
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

export default ErrorBoundary;
