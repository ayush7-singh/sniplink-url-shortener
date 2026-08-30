const { Router } = require('express');
const { pool } = require('../db');
const { getCachedUrl, setCachedUrl } = require('../cache');
const { publishClickEvent } = require('../queue');
const { urlRedirectsTotal, eventsPublishedTotal } = require('../metrics');

const router = Router();

/**
 * GET /:code
 * Redirects to the original URL.
 * Publishes a click event to RabbitMQ asynchronously.
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // 1. Check Redis cache first
    let originalUrl = await getCachedUrl(code);
    const isCacheHit = !!originalUrl;

    if (!originalUrl) {
      // 2. Cache miss → query Postgres
      const result = await pool.query(
        'SELECT original_url FROM urls WHERE short_code = $1',
        [code]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Short URL not found' });
      }

      originalUrl = result.rows[0].original_url;

      // 3. Populate cache for future lookups
      await setCachedUrl(code, originalUrl);
    }

    urlRedirectsTotal.inc({ cache_hit: isCacheHit ? 'true' : 'false' });

    // 4. Publish click event (fire-and-forget, non-blocking)
    publishClickEvent({
      shortCode: code,
      timestamp: new Date().toISOString(),
      referrer: req.get('referer') || req.get('referrer') || null,
      userAgent: req.get('user-agent') || null,
      ip: req.ip,
    });
    eventsPublishedTotal.inc();

    // 5. Increment click count in Postgres (async, don't block redirect)
    pool.query(
      'UPDATE urls SET click_count = click_count + 1 WHERE short_code = $1',
      [code]
    ).catch((err) => console.error('[Redirect] Failed to increment click count:', err.message));

    // 6. 302 redirect
    res.redirect(302, originalUrl);
  } catch (err) {
    console.error('[Redirect] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /:code/stats
 * Returns metadata and click count for a short URL.
 */
router.get('/:code/stats', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      'SELECT short_code, original_url, click_count, created_at FROM urls WHERE short_code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    const row = result.rows[0];
    res.json({
      shortCode: row.short_code,
      originalUrl: row.original_url,
      clickCount: row.click_count,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('[Stats] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
