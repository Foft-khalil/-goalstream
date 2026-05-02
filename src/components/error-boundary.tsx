'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] px-6 py-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center mb-6">
            <AlertTriangle className="h-10 w-10 text-red-500/60" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            Oops!
          </h2>
          <p className="text-sm text-muted-foreground/70 max-w-md mb-6">
            An unexpected error occurred. Please try again.
          </p>
          <Button
            onClick={this.handleRetry}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-6 text-left text-xs text-red-400/60 bg-red-500/5 border border-red-500/10 rounded-lg p-4 max-w-lg overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
