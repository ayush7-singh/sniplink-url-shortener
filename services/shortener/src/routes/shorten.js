const { Router } = require('express');
const { nanoid } = require('nanoid');
const { pool } = require('../db');
const config = require('../config');
const { urlsShortenedTotal } = require('../metrics');

const router = Router();

const RESERVED_SLUGS = new Set(['api', 'metrics', 'healthz', 'readyz', 'stats', 'swagger', 'admin', 'dashboard']);

/**
 * POST /api/shorten
 * Creates a new short URL.
 * Body: { url: string, customAlias?: string }
 * Returns: { shortCode, shortUrl, originalUrl, createdAt }
 */
router.post('/', async (req, res) => {
  try {
    const { url, customAlias, customCode } = req.body;

    // Validate URL
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const alias = (customAlias || customCode || '').trim();
    let shortCode;

    if (alias) {
      // Validate custom alias format
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(alias)) {
        return res.status(400).json({
          error: 'Custom alias must be 3-30 alphanumeric characters, hyphens, or underscores',
        });
      }

      if (RESERVED_SLUGS.has(alias.toLowerCase())) {
        return res.status(400).json({ error: `Alias "${alias}" is a reserved system keyword` });
      }

      const existing = await pool.query(
        'SELECT id FROM urls WHERE short_code = $1',
        [alias]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: `Alias "${alias}" is already taken` });
      }

      shortCode = alias;
    } else {
      // Generate a unique short code (retry on collision)
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        shortCode = nanoid(7);
        const existing = await pool.query(
          'SELECT id FROM urls WHERE short_code = $1',
          [shortCode]
        );
        if (existing.rows.length === 0) break;
        attempts++;
      }

      if (attempts >= maxAttempts) {
        return res.status(500).json({ error: 'Failed to generate unique short code' });
      }
    }

    // Insert into database
    const result = await pool.query(
      'INSERT INTO urls (short_code, original_url) VALUES ($1, $2) RETURNING *',
      [shortCode, url]
    );

    urlsShortenedTotal.inc();

    const row = result.rows[0];
    res.status(201).json({
      shortCode: row.short_code,
      shortUrl: `${config.baseUrl}/${row.short_code}`,
      originalUrl: row.original_url,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('[Shorten] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
