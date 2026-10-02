import React from "react";

/**
 * Root-level ErrorBoundary.
 *
 * Catches unexpected rendering errors (including the known
 * "Failed to execute 'removeChild' on 'Node'" raised when the browser's
 * auto-translator mutates the DOM mid-reconciliation). Instead of leaving
 * the user on a blank white screen, we show a friendly fallback and give
 * them a way to recover (reload). The real root cause (auto-translate) is
 * disabled at the HTML level via <meta name="google" content="notranslate">
 * and translate="no" on <html>. This boundary is only an extra safety net.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Surface to the console so we can still see production issues.
    // eslint-disable-next-line no-console
    console.error("[OrçaNext ErrorBoundary]", error, info);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch (_) {}
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        data-testid="error-boundary-fallback"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#ffffff",
          color: "#000000",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: 14,
              background: "#00AD02",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
            Algo deu errado por um instante
          </h1>
          <p style={{ fontSize: 14, color: "#52525b", margin: "0 0 20px", lineHeight: 1.5 }}>
            Recarregue a página para continuar. Seus dados estão salvos.
          </p>
          <button
            data-testid="error-boundary-reload"
            onClick={this.handleReload}
            style={{
              background: "#00AD02",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
