const { Router } = require('express');
const { pool } = require('../db');
const config = require('../config');

const router = Router();

/**
 * GET /api/urls
 * Lists all shortened URLs, paginated, newest first.
 * Query params: page (default 1), limit (default 20)
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [urlsResult, countResult] = await Promise.all([
      pool.query(
        'SELECT short_code, original_url, click_count, created_at FROM urls ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM urls'),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      urls: urlsResult.rows.map((row) => ({
        shortCode: row.short_code,
        shortUrl: `${config.baseUrl}/${row.short_code}`,
        originalUrl: row.original_url,
        clickCount: row.click_count,
        createdAt: row.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[URLs] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
