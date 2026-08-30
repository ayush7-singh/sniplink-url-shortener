import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  BarChart3, 
  ExternalLink, 
  Search, 
  Link as LinkIcon, 
  MousePointerClick, 
  Calendar,
  QrCode
} from 'lucide-react';

export default function UrlTable({ urls, onSelectAnalytics, onOpenQrCode, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  const filteredUrls = urls.filter((u) => 
    u.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.originalUrl.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyToClipboard = (text, code) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="glass-card" style={{ marginTop: '24px' }}>
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h2>Active Short Links</h2>
          <p>Manage destinations, monitor live traffic, and inspect click streams</p>
        </div>

        <div className="table-search-bar">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="table-search-input"
            placeholder="Search by code or original URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredUrls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <LinkIcon size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>No shortened URLs found.</p>
          <p style={{ fontSize: '0.85rem' }}>Paste a link above to create your first trackable short URL.</p>
        </div>
      ) : (
        <div className="urls-table-container">
          <table className="urls-table">
            <thead>
              <tr>
                <th>Short Code</th>
                <th>Destination URL</th>
                <th>Clicks</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUrls.map((url) => (
                <tr key={url.shortCode}>
                  <td>
                    <span className="short-code-badge">
                      /{url.shortCode}
                    </span>
                  </td>
                  <td>
                    <div className="orig-url-cell" title={url.originalUrl}>
                      <a 
                        href={url.originalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {url.originalUrl}
                      </a>
                    </div>
                  </td>
                  <td>
                    <span className="clicks-badge">
                      <MousePointerClick size={13} /> {url.clickCount || 0}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {new Date(url.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {/* Copy Short URL */}
                      <button
                        className={`btn-icon ${copiedCode === url.shortCode ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(url.shortUrl, url.shortCode)}
                        title="Copy short link"
                      >
                        {copiedCode === url.shortCode ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedCode === url.shortCode ? 'Copied' : 'Copy'}</span>
                      </button>

                      {/* Test Redirect in new tab */}
                      <a
                        href={url.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-icon"
                        title="Open redirect (triggers RabbitMQ click event)"
                        onClick={() => setTimeout(onRefresh, 1000)}
                      >
                        <ExternalLink size={14} />
                      </a>

                      {/* QR Code Modal Button */}
                      <button
                        className="btn-icon"
                        style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'var(--border-subtle)' }}
                        onClick={() => onOpenQrCode(url)}
                        title="Generate QR Code"
                      >
                        <QrCode size={14} />
                        <span>QR</span>
                      </button>

                      {/* View Analytics Modal */}
                      <button
                        className="btn-icon"
                        style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#818cf8' }}
                        onClick={() => onSelectAnalytics(url)}
                        title="View analytics charts"
                      >
                        <BarChart3 size={14} />
                        <span>Analytics</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
