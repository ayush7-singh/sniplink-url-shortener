import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, Copy, Check, ExternalLink, QrCode } from 'lucide-react';

export default function QrCodeModal({ url, shortCode, originalUrl, onClose }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const qrRef = useRef(null);

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const pngUrl = canvas
      .toDataURL('image/png')
      .replace('image/png', 'image/octet-stream');

    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `sniplink-${shortCode || 'qrcode'}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-card modal-container qr-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
              <QrCode size={20} />
            </div>
            <div>
              <h2 className="modal-title">QR Code</h2>
              <p className="modal-subtitle">Scan to redirect on mobile or download for sharing</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* QR Code Presentation Box */}
        <div className="qr-body">
          <div className="qr-canvas-wrapper" ref={qrRef}>
            <QRCodeCanvas
              value={url}
              size={220}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>

          <div className="qr-url-pill">
            <span className="qr-url-text">{url}</span>
            <button
              className={`btn-icon ${copied ? 'copied' : ''}`}
              onClick={handleCopyLink}
              title="Copy Short URL"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {originalUrl && (
            <div className="qr-dest-preview">
              <span className="text-muted">Target: </span>
              <a
                href={originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="qr-dest-link"
              >
                {originalUrl} <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </a>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-footer qr-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={handleDownload}>
            {downloaded ? <Check size={16} /> : <Download size={16} />}
            <span>{downloaded ? 'Downloaded!' : 'Download PNG'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
