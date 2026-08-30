import React, { useState, useEffect } from 'react';
import { 
  Link2, 
  Sparkles, 
  ArrowRight, 
  Copy, 
  Check, 
  ExternalLink, 
  BarChart3, 
  Zap, 
  Server, 
  Layers, 
  ShieldCheck,
  AlertCircle,
  QrCode,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';
import UrlTable from './components/UrlTable';
import AnalyticsModal from './components/AnalyticsModal';
import QrCodeModal from './components/QrCodeModal';

const SHORTENER_API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ANALYTICS_API = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:3002';

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [urls, setUrls] = useState([]);
  const [selectedAnalyticsUrl, setSelectedAnalyticsUrl] = useState(null);
  const [selectedQrCodeUrl, setSelectedQrCodeUrl] = useState(null);
  const [backendHealthy, setBackendHealthy] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Check health status of shortener & analytics backend
  const checkHealth = async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${SHORTENER_API}/healthz`),
        fetch(`${ANALYTICS_API}/healthz`)
      ]);
      setBackendHealthy(sRes.ok && aRes.ok);
    } catch {
      setBackendHealthy(false);
    }
  };

  // Fetch list of shortened URLs
  const fetchUrls = async () => {
    try {
      const res = await fetch(`${SHORTENER_API}/api/urls?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setUrls(data.urls || []);
      }
    } catch (err) {
      console.error('Failed to load URLs:', err);
    }
  };

  useEffect(() => {
    checkHealth();
    fetchUrls();
    const interval = setInterval(fetchUrls, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleShorten = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    let target = urlInput.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }

    try {
      setLoading(true);
      const payload = { url: target };
      if (customAlias.trim()) {
        payload.customAlias = customAlias.trim();
      }

      const res = await fetch(`${SHORTENER_API}/api/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          addToast('Rate limit exceeded: Max 10 requests / minute.', 'error');
        } else {
          addToast(data.error || 'Failed to shorten URL', 'error');
        }
        return;
      }

      setCreatedLink(data);
      setUrlInput('');
      setCustomAlias('');
      addToast('Short link created successfully!', 'success');
      fetchUrls();
    } catch (err) {
      console.error(err);
      addToast('Cannot connect to Shortener API. Is the service running?', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyShortUrl = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast('Copied short URL to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="header">
        <div className="brand-logo">
          <div className="logo-icon-wrap">
            <Link2 size={22} />
          </div>
          <span className="brand-name">SnipLink</span>
          <span className="brand-badge">Cloud-Native v1.0</span>
        </div>

        <div className="header-status-group">
          {backendHealthy === null ? (
            <div className="status-pill" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
              Checking services...
            </div>
          ) : backendHealthy ? (
            <div className="status-pill">
              <span className="status-dot"></span>
              Microservices Online
            </div>
          ) : (
            <div className="status-pill error">
              <span className="status-dot"></span>
              Services Disconnected
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-tag">
          <Sparkles size={14} />
          <span>High-Throughput Microservices URL Engine</span>
        </div>
        <h1 className="hero-title">
          Shorten, Scale, and <br />
          <span className="gradient-text">Stream Real-Time Analytics</span>
        </h1>
        <p className="hero-desc">
          Powered by Node.js, Redis caching, RabbitMQ async event streaming, and PostgreSQL analytics.
        </p>
      </div>

      {/* Main Shortening Input Card */}
      <div className="glass-card shorten-box">
        <form onSubmit={handleShorten}>
          <div className="input-group-wrapper">
            <div className="url-input-icon">
              <Link2 size={20} />
            </div>
            <input
              type="text"
              className="url-input"
              placeholder="Paste your long link here (e.g., https://github.com/kubernetes/kubernetes)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !urlInput.trim()}
            >
              {loading ? (
                <span>Generating...</span>
              ) : (
                <>
                  <span>Shorten URL</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

          {/* Custom Vanity Alias Toggle */}
          <div className="custom-alias-toggle-row">
            <button
              type="button"
              className="btn-text-toggle"
              onClick={() => setShowCustomOptions(!showCustomOptions)}
            >
              <SlidersHorizontal size={14} />
              <span>Custom Vanity Alias</span>
              {showCustomOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Expandable Custom Alias Form */}
          {showCustomOptions && (
            <div className="custom-alias-drawer">
              <div className="custom-alias-input-wrap">
                <span className="custom-alias-prefix">sniplink/</span>
                <input
                  type="text"
                  className="custom-alias-input"
                  placeholder="my-custom-slug (optional)"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="custom-alias-hint">
                3-30 characters (letters, numbers, hyphens, underscores).
              </p>
            </div>
          )}
        </form>

        {/* Shortened URL Result Card */}
        {createdLink && (
          <div className="result-card">
            <div className="result-header">
              <span className="result-title">
                <ShieldCheck size={18} /> Link Ready & Cached
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Code: <code style={{ color: '#818cf8' }}>{createdLink.shortCode}</code>
              </span>
            </div>

            <div className="result-link-row">
              <a
                href={createdLink.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="result-url-text"
              >
                {createdLink.shortUrl}
              </a>

              <div className="result-actions">
                <button
                  className={`btn-icon ${copied ? 'copied' : ''}`}
                  onClick={() => copyShortUrl(createdLink.shortUrl)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  className="btn-icon"
                  style={{ background: 'rgba(255, 255, 255, 0.06)', borderColor: 'var(--border-subtle)' }}
                  onClick={() => setSelectedQrCodeUrl({ url: createdLink.shortUrl, shortCode: createdLink.shortCode, originalUrl: createdLink.originalUrl })}
                  title="Generate QR Code"
                >
                  <QrCode size={14} />
                  <span>QR Code</span>
                </button>

                <a
                  href={createdLink.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-icon"
                  title="Test redirect"
                >
                  <ExternalLink size={14} />
                  <span>Visit</span>
                </a>

                <button
                  className="btn-icon"
                  style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', borderColor: 'rgba(99, 102, 241, 0.4)' }}
                  onClick={() => setSelectedAnalyticsUrl({ shortCode: createdLink.shortCode, originalUrl: createdLink.originalUrl })}
                >
                  <BarChart3 size={14} />
                  <span>Inspect</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature Highlights Grid */}
      <div className="feature-grid">
        <div className="feature-pill-card">
          <div className="feature-icon-box purple">
            <Zap size={20} />
          </div>
          <div>
            <div className="feature-title">Redis Sub-Millisecond Cache</div>
            <div className="feature-desc">Read-through caching for instant 302 redirects with minimal database load.</div>
          </div>
        </div>

        <div className="feature-pill-card">
          <div className="feature-icon-box cyan">
            <Layers size={20} />
          </div>
          <div>
            <div className="feature-title">RabbitMQ Event Pipeline</div>
            <div className="feature-desc">Non-blocking click-stream publishing decoupled from the redirect critical path.</div>
          </div>
        </div>

        <div className="feature-pill-card">
          <div className="feature-icon-box emerald">
            <Server size={20} />
          </div>
          <div>
            <div className="feature-title">Stateless Microservices</div>
            <div className="feature-desc">Container-ready with health probes, ready for Kubernetes HPA auto-scaling.</div>
          </div>
        </div>
      </div>

      {/* URLs Dashboard Table */}
      <UrlTable
        urls={urls}
        onSelectAnalytics={(u) => setSelectedAnalyticsUrl(u)}
        onOpenQrCode={(u) => setSelectedQrCodeUrl({ url: u.shortUrl, shortCode: u.shortCode, originalUrl: u.originalUrl })}
        onRefresh={fetchUrls}
      />

      {/* Detailed Analytics Modal */}
      {selectedAnalyticsUrl && (
        <AnalyticsModal
          shortCode={selectedAnalyticsUrl.shortCode}
          originalUrl={selectedAnalyticsUrl.originalUrl}
          onClose={() => setSelectedAnalyticsUrl(null)}
        />
      )}

      {/* QR Code Modal */}
      {selectedQrCodeUrl && (
        <QrCodeModal
          url={selectedQrCodeUrl.url}
          shortCode={selectedQrCodeUrl.shortCode}
          originalUrl={selectedQrCodeUrl.originalUrl}
          onClose={() => setSelectedQrCodeUrl(null)}
        />
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

