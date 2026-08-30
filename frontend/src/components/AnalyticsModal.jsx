import React, { useEffect, useState } from 'react';
import { 
  X, 
  MousePointerClick, 
  Users, 
  Clock, 
  Calendar, 
  Globe, 
  Activity, 
  RefreshCw,
  ExternalLink 
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

const ANALYTICS_API = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:3002';
const SHORTENER_API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AnalyticsModal({ shortCode, originalUrl, onClose }) {
  const [data, setData] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, seriesRes] = await Promise.all([
        fetch(`${ANALYTICS_API}/api/analytics/${shortCode}`),
        fetch(`${ANALYTICS_API}/api/analytics/${shortCode}/timeseries`)
      ]);

      if (!statsRes.ok || !seriesRes.ok) {
        throw new Error('Could not fetch analytics data');
      }

      const statsData = await statsRes.json();
      const seriesData = await seriesRes.json();

      setData(statsData);
      setTimeseries(seriesData.timeseries || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [shortCode]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="short-code-badge">/{shortCode}</span>
              <h2 style={{ fontSize: '1.4rem' }}>Real-time Click Analytics</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', wordBreak: 'break-all' }}>
              Destination: <a href={originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>{originalUrl}</a>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-icon" onClick={fetchAnalytics} title="Refresh metrics">
              <RefreshCw size={15} />
            </button>
            <button className="close-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity className="animate-spin" size={32} style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
            <p>Aggregating click stream metrics from PostgreSQL & RabbitMQ...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--accent-rose)' }}>
            <p>{error}</p>
            <button className="btn-icon" onClick={fetchAnalytics} style={{ margin: '16px auto 0' }}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Metric KPI Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MousePointerClick size={14} /> Total Clicks
                </div>
                <div className="stat-value cyan">{data?.totalClicks || 0}</div>
              </div>

              <div className="stat-card">
                <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} /> Unique Visitors
                </div>
                <div className="stat-value purple">{data?.uniqueVisitors || 0}</div>
              </div>

              <div className="stat-card">
                <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Last 24 Hours
                </div>
                <div className="stat-value emerald">{data?.clicks24h || 0}</div>
              </div>

              <div className="stat-card">
                <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} /> Last 7 Days
                </div>
                <div className="stat-value amber">{data?.clicks7d || 0}</div>
              </div>
            </div>

            {/* Time Series Area Chart */}
            <div className="chart-container">
              <div className="chart-title">Daily Click Traffic (Last 14 Days)</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="clickColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b" 
                      fontSize={11} 
                      tickFormatter={(d) => d.slice(5)} 
                    />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        borderColor: 'rgba(255,255,255,0.1)', 
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="#818cf8" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#clickColor)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Referrers & Recent Events */}
            <div className="analytics-two-col">
              <div className="section-box">
                <h4><Globe size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> Top Referrers</h4>
                {(!data?.topReferrers || data.topReferrers.length === 0) ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No referrer data recorded yet.</p>
                ) : (
                  data.topReferrers.map((item, idx) => (
                    <div key={idx} className="referrer-item">
                      <span className="referrer-name" title={item.referrer}>{item.referrer}</span>
                      <span className="referrer-count">{item.count} clicks</span>
                    </div>
                  ))
                )}
              </div>

              <div className="section-box">
                <h4><Activity size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> Recent Click Events</h4>
                {(!data?.recentClicks || data.recentClicks.length === 0) ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No click events logged yet.</p>
                ) : (
                  data.recentClicks.slice(0, 5).map((evt) => (
                    <div key={evt.id} className="recent-event-row">
                      <span>{new Date(evt.clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span style={{ color: '#38bdf8' }}>{evt.ip_address || '127.0.0.1'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
