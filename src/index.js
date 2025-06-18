import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/App.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Service worker registration for offline support
import reportWebVitals from './reportWebVitals';

// Create root element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Error boundary component for catching React errors
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    
    // Log error to console for debugging
    console.error('React Error Boundary caught an error:', error, errorInfo);
    
    // In production, you might want to send errors to a logging service
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear storage:', err);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-icon">⚠️</div>
          <h1 className="error-title">Something went wrong</h1>
          <p className="error-message">
            The application encountered an unexpected error. This could be due to a network issue, 
            browser compatibility problem, or a temporary service disruption.
          </p>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="error-details">
              <summary>Error Details (Development Mode)</summary>
              <pre className="error-stack">
                {this.state.error.toString()}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          
          <div className="error-actions">
            <button className="error-button" onClick={this.handleReload}>
              <i className="fas fa-refresh"></i>
              Refresh Page
            </button>
            <button className="error-button secondary" onClick={this.handleClearStorage}>
              <i className="fas fa-broom"></i>
              Clear Cache & Reload
            </button>
            <a 
              href="https://status.wedged.protocol" 
              className="error-button secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fas fa-chart-line"></i>
              Check Status
            </a>
          </div>
          
          <div className="error-suggestions">
            <h3>Troubleshooting Steps:</h3>
            <ul>
              <li>Refresh the page or try again in a few minutes</li>
              <li>Check your internet connection</li>
              <li>Ensure your wallet is connected and unlocked</li>
              <li>Try using an incognito/private browsing window</li>
              <li>Update your browser to the latest version</li>
              <li>Disable browser extensions that might interfere</li>
            </ul>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Global error handlers for better error tracking
window.addEventListener('error', (event) => {
  console.error('Global JavaScript error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise rejection:', event.reason);
  // Prevent the default browser behavior
  event.preventDefault();
});

// Initialize the app
function initializeApp() {
  try {
    // Check for required browser features
    const requiredFeatures = [
      'Promise',
      'fetch',
      'localStorage',
      'sessionStorage',
      'WebSocket'
    ];

    const missingFeatures = requiredFeatures.filter(feature => !(feature in window));
    
    if (missingFeatures.length > 0) {
      console.error('Missing required browser features:', missingFeatures);
      root.render(
        <div className="error-boundary">
          <div className="error-icon">🌐</div>
          <h1 className="error-title">Browser Not Supported</h1>
          <p className="error-message">
            Your browser is missing required features: {missingFeatures.join(', ')}. 
            Please update your browser or use a modern browser like Chrome, Firefox, Safari, or Edge.
          </p>
          <div className="error-actions">
            <a 
              href="https://browsehappy.com/" 
              className="error-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fas fa-download"></i>
              Update Browser
            </a>
          </div>
        </div>
      );
      return;
    }

    // Check for Web3 wallet early (optional check)
    if (!window.ethereum) {
      console.warn('No Web3 wallet detected. Users will need to install one to interact with the protocol.');
    }

    // Render the main application
    root.render(
      <React.StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </React.StrictMode>
    );

    // Hide loading screen after a brief delay
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 500);
      }
    }, 1500);

  } catch (error) {
    console.error('Failed to initialize app:', error);
    
    // Fallback error UI
    root.render(
      <div className="error-boundary">
        <div className="error-icon">❌</div>
        <h1 className="error-title">Initialization Failed</h1>
        <p className="error-message">
          The application failed to initialize properly. Please refresh the page or contact support if the problem persists.
        </p>
        <div className="error-actions">
          <button className="error-button" onClick={() => window.location.reload()}>
            <i className="fas fa-refresh"></i>
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Performance monitoring
if ('performance' in window && 'getEntriesByType' in performance) {
  // Measure and report Core Web Vitals
  function reportWebVitals(metric) {
    console.log('Web Vital:', metric);
    
    // In production, you might want to send these to an analytics service
    if (process.env.NODE_ENV === 'production') {
      // Example: analytics.track('web-vital', metric);
    }
  }

  // Import and use web vitals library if available
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(reportWebVitals);
    getFID(reportWebVitals);
    getFCP(reportWebVitals);
    getLCP(reportWebVitals);
    getTTFB(reportWebVitals);
  }).catch(() => {
    // web-vitals library not available, skip
  });
}

// Service worker registration for offline support and caching
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, show update notification
              console.log('New content available! Please refresh.');
              
              // You could show a notification here
              if (window.confirm('A new version is available. Refresh to update?')) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Cleanup any active connections, timers, etc.
  console.log('App cleanup on page unload');
});

// Handle page visibility changes (for pausing/resuming activities)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('App is now hidden');
    // Pause expensive operations
  } else {
    console.log('App is now visible');
    // Resume operations
  }
});

// Development-only helpers
if (process.env.NODE_ENV === 'development') {
  // Add global debug helpers
  window.__WEDGED_DEBUG__ = {
    clearStorage: () => {
      localStorage.clear();
      sessionStorage.clear();
      console.log('Storage cleared');
    },
    
    reloadApp: () => {
      window.location.reload();
    },
    
    checkWallet: () => {
      console.log('Wallet detection:', {
        ethereum: !!window.ethereum,
        isMetaMask: window.ethereum?.isMetaMask,
        accounts: window.ethereum?.selectedAddress
      });
    }
  };
  
  console.log('Development mode active. Global debug helpers available at window.__WEDGED_DEBUG__');
}

export default App;
