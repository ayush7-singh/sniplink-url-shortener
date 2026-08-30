const { test, describe } = require('node:test');
const assert = require('node:assert');
const config = require('../src/config');

describe('Analytics Service - Unit Tests', () => {
  describe('Click Event Payload Normalization', () => {
    function normalizeEvent(raw) {
      if (!raw || typeof raw !== 'object') {
        throw new Error('Invalid payload');
      }
      if (!raw.shortCode || typeof raw.shortCode !== 'string') {
        throw new Error('Missing shortCode');
      }

      return {
        shortCode: raw.shortCode,
        clickedAt: raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString(),
        referrer: raw.referrer || null,
        userAgent: raw.userAgent || null,
        ipAddress: raw.ip || null,
      };
    }

    test('normalizes a full click event payload', () => {
      const payload = {
        shortCode: 'abc1234',
        timestamp: '2026-08-30T00:00:00.000Z',
        referrer: 'https://news.ycombinator.com',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ip: '192.168.1.1',
      };

      const normalized = normalizeEvent(payload);
      assert.strictEqual(normalized.shortCode, 'abc1234');
      assert.strictEqual(normalized.clickedAt, '2026-08-30T00:00:00.000Z');
      assert.strictEqual(normalized.referrer, 'https://news.ycombinator.com');
      assert.strictEqual(normalized.ipAddress, '192.168.1.1');
    });

    test('fills default timestamp and nulls for optional metadata', () => {
      const payload = { shortCode: 'xyz7890' };
      const normalized = normalizeEvent(payload);
      assert.strictEqual(normalized.shortCode, 'xyz7890');
      assert.ok(typeof normalized.clickedAt === 'string');
      assert.strictEqual(normalized.referrer, null);
      assert.strictEqual(normalized.userAgent, null);
      assert.strictEqual(normalized.ipAddress, null);
    });

    test('throws error when shortCode is missing or payload is null', () => {
      assert.throws(() => normalizeEvent({}), /Missing shortCode/);
      assert.throws(() => normalizeEvent(null), /Invalid payload/);
    });
  });

  describe('Referrer Domain Parsing', () => {
    function getReferrerCategory(referrer) {
      if (!referrer) return 'Direct / None';
      try {
        const url = new URL(referrer);
        return url.hostname;
      } catch {
        return referrer;
      }
    }

    test('extracts hostname from valid referrers', () => {
      assert.strictEqual(getReferrerCategory('https://github.com/kubernetes'), 'github.com');
      assert.strictEqual(getReferrerCategory('http://reddit.com/r/programming'), 'reddit.com');
    });

    test('returns Direct / None when referrer is missing or empty', () => {
      assert.strictEqual(getReferrerCategory(''), 'Direct / None');
      assert.strictEqual(getReferrerCategory(null), 'Direct / None');
      assert.strictEqual(getReferrerCategory(undefined), 'Direct / None');
    });
  });

  describe('Configuration Defaults', () => {
    test('provides valid port and queue configuration', () => {
      assert.ok(typeof config.port === 'number');
      assert.ok(config.port > 0);
      assert.strictEqual(config.queue.name, 'click_events');
    });
  });
});
