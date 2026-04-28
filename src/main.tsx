import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown startup error',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: '24px', fontFamily: 'Georgia, serif', color: '#1c1917' }}>
          <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>VoltShare failed to load</h1>
          <p style={{ marginBottom: '8px' }}>
            This device hit a startup error. Please refresh once. If the problem continues, try a private window or a different browser.
          </p>
          <p style={{ fontSize: '14px', opacity: 0.75 }}>Technical message: {this.state.message}</p>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
