const Redis = require('ioredis');
const config = require('./config');

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

redis.on('connect', () => console.log('[Cache] Redis connected'));
redis.on('error', (err) => console.error('[Cache] Redis error:', err.message));

/**
 * Get a cached URL by short code.
 * @param {string} shortCode
 * @returns {string|null} The original URL or null if not cached
 */
async function getCachedUrl(shortCode) {
  const url = await redis.get(`url:${shortCode}`);
  return url;
}

/**
 * Cache a URL mapping.
 * @param {string} shortCode
 * @param {string} originalUrl
 */
async function setCachedUrl(shortCode, originalUrl) {
  await redis.set(`url:${shortCode}`, originalUrl, 'EX', config.cache.ttl);
}

module.exports = { redis, getCachedUrl, setCachedUrl };
