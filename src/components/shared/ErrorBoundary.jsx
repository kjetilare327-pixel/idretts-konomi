import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || '';
    // Silently redirect if the error is just "useTeam outside TeamProvider"
    if (msg.includes('useTeam must be used within TeamProvider') || msg.includes('TeamProvider')) {
      if (typeof window !== 'undefined') {
        window.location.replace(window.location.origin + '/?page=Dashboard');
      }
      return null;
    }

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', padding: 24, fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          padding: 32, maxWidth: 400, width: '100%', textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>
            Noe gikk galt
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 24 }}>
            {this.state.error?.message || 'En uventet feil oppstod. Prøv å laste siden på nytt.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#059669', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem'
              }}
            >
              Last inn på nytt
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                background: 'transparent', color: '#059669', border: '1px solid #059669',
                borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem'
              }}
            >
              Gå til innlogging
            </button>
          </div>
        </div>
      </div>
    );
  }
}