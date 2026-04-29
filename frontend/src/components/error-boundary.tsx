import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary
 * Catches JavaScript errors in child component tree and displays fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to console in development
    console.error('Error Boundary caught an error:', error, errorInfo);

    // In production, you might want to send this to an error reporting service
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-[#111118] border border-white/[0.08] rounded-2xl p-8 text-center">
              {/* Error Icon */}
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>

              {/* Title */}
              <h1 className="text-xl font-semibold text-white mb-2">
                Something went wrong
              </h1>

              {/* Description */}
              <p className="text-sm text-white/60 mb-6">
                An unexpected error occurred. Please try refreshing the page or go back to the home page.
              </p>

              {/* Error Details (Development only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-left">
                  <p className="text-xs font-mono text-red-400 mb-2">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-[10px] font-mono text-white/40 overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-sm font-medium transition-all"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
                <button
                  onClick={this.handleRefresh}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-white/30 mt-4">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to manually trigger error boundary
 */
export function useErrorBoundary() {
  const [, setError] = React.useState<Error | null>(null);

  const showBoundary = React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);

  return { showBoundary };
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
