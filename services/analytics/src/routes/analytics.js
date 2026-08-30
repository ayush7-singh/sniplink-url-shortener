const { Router } = require('express');
const { pool } = require('../db');

const router = Router();

/**
 * GET /api/analytics/:code
 * Returns summary analytics for a given short code:
 * - total clicks
 * - unique visitors (approx by ip_address)
 * - top referrers
 * - top user agents
 * - clicks in last 24h, 7d, 30d
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // 1. Check if short code exists in urls table (if available) or has click events
    const totalClicksResult = await pool.query(
      'SELECT COUNT(*) AS total_clicks, COUNT(DISTINCT ip_address) AS unique_visitors FROM click_events WHERE short_code = $1',
      [code]
    );

    const totalClicks = parseInt(totalClicksResult.rows[0].total_clicks, 10);
    const uniqueVisitors = parseInt(totalClicksResult.rows[0].unique_visitors, 10);

    // 2. Clicks by time windows (24h, 7d, 30d)
    const timeWindowsResult = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE clicked_at >= NOW() - INTERVAL '24 hours') AS clicks_24h,
        COUNT(*) FILTER (WHERE clicked_at >= NOW() - INTERVAL '7 days') AS clicks_7d,
        COUNT(*) FILTER (WHERE clicked_at >= NOW() - INTERVAL '30 days') AS clicks_30d
       FROM click_events
       WHERE short_code = $1`,
      [code]
    );

    // 3. Top Referrers
    const referrersResult = await pool.query(
      `SELECT COALESCE(referrer, 'Direct / None') AS referrer, COUNT(*) AS count
       FROM click_events
       WHERE short_code = $1
       GROUP BY referrer
       ORDER BY count DESC
       LIMIT 5`,
      [code]
    );

    // 4. Recent Clicks (last 10 events)
    const recentEventsResult = await pool.query(
      `SELECT id, clicked_at, referrer, user_agent, ip_address
       FROM click_events
       WHERE short_code = $1
       ORDER BY clicked_at DESC
       LIMIT 10`,
      [code]
    );

    res.json({
      shortCode: code,
      totalClicks,
      uniqueVisitors,
      clicks24h: parseInt(timeWindowsResult.rows[0].clicks_24h, 10) || 0,
      clicks7d: parseInt(timeWindowsResult.rows[0].clicks_7d, 10) || 0,
      clicks30d: parseInt(timeWindowsResult.rows[0].clicks_30d, 10) || 0,
      topReferrers: referrersResult.rows,
      recentClicks: recentEventsResult.rows,
    });
  } catch (err) {
    console.error('[Analytics] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/:code/timeseries
 * Returns daily click counts for the last 14 days formatted for charting.
 */
router.get('/:code/timeseries', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `SELECT
         TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
         COUNT(c.id) AS clicks
       FROM (
         SELECT generate_series(
           CURRENT_DATE - INTERVAL '13 days',
           CURRENT_DATE,
           '1 day'::interval
         )::date AS day
       ) d
       LEFT JOIN click_events c
         ON DATE(c.clicked_at) = d.day AND c.short_code = $1
       GROUP BY d.day
       ORDER BY d.day ASC`,
      [code]
    );

    res.json({
      shortCode: code,
      timeseries: result.rows.map((row) => ({
        date: row.date,
        clicks: parseInt(row.clicks, 10),
      })),
    });
  } catch (err) {
    console.error('[Timeseries] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
