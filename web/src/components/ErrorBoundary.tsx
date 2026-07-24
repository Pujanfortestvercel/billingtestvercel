import { Component, ReactNode, ErrorInfo } from 'react';
import { Button, Card } from './UI';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Card style={{ maxWidth: 400, textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
            <p className="muted" style={{ marginBottom: 24 }}>
              {this.state.error?.message ?? 'An unexpected error occurred in the application.'}
            </p>
            <Button title="Try Again" onClick={this.handleReset} />
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
