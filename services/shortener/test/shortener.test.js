const { test, describe } = require('node:test');
const assert = require('node:assert');
const { nanoid } = require('nanoid');
const config = require('../src/config');

describe('Shortener Service - Unit Tests', () => {
  describe('URL Validation Logic', () => {
    function isValidUrl(input) {
      if (!input || typeof input !== 'string') return false;
      try {
        const parsed = new URL(input);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }

    test('accepts valid HTTPS URL', () => {
      assert.strictEqual(isValidUrl('https://github.com/kubernetes/kubernetes'), true);
    });

    test('accepts valid HTTP URL with port and query params', () => {
      assert.strictEqual(isValidUrl('http://localhost:8080/search?q=test&page=1'), true);
    });

    test('rejects malformed URLs', () => {
      assert.strictEqual(isValidUrl('not-a-valid-url'), false);
      assert.strictEqual(isValidUrl('ftp://example.com'), false);
      assert.strictEqual(isValidUrl(''), false);
      assert.strictEqual(isValidUrl(null), false);
      assert.strictEqual(isValidUrl(undefined), false);
    });
  });

  describe('Short Code Generation (nanoid)', () => {
    test('generates 7-character alphanumeric string', () => {
      const code = nanoid(7);
      assert.strictEqual(code.length, 7);
      assert.match(code, /^[A-Za-z0-9_-]{7}$/);
    });

    test('generates unique codes across multiple iterations', () => {
      const codes = new Set();
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        codes.add(nanoid(7));
      }
      assert.strictEqual(codes.size, iterations);
    });
  });

  describe('Custom Alias Validation', () => {
    const RESERVED_SLUGS = new Set(['api', 'metrics', 'healthz', 'readyz', 'stats', 'swagger', 'admin', 'dashboard']);
    function validateAlias(alias) {
      if (!alias || typeof alias !== 'string') return { valid: false, reason: 'Empty' };
      const trimmed = alias.trim();
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(trimmed)) return { valid: false, reason: 'Invalid format' };
      if (RESERVED_SLUGS.has(trimmed.toLowerCase())) return { valid: false, reason: 'Reserved keyword' };
      return { valid: true, alias: trimmed };
    }

    test('accepts valid custom aliases', () => {
      assert.strictEqual(validateAlias('my-cool-link').valid, true);
      assert.strictEqual(validateAlias('devops_2026').valid, true);
      assert.strictEqual(validateAlias('k8s').valid, true);
    });

    test('rejects reserved slug keywords', () => {
      assert.strictEqual(validateAlias('api').valid, false);
      assert.strictEqual(validateAlias('metrics').valid, false);
      assert.strictEqual(validateAlias('healthz').valid, false);
    });

    test('rejects aliases with spaces, symbols, or invalid length', () => {
      assert.strictEqual(validateAlias('ab').valid, false);
      assert.strictEqual(validateAlias('a'.repeat(31)).valid, false);
      assert.strictEqual(validateAlias('bad alias!').valid, false);
      assert.strictEqual(validateAlias('slash/bad').valid, false);
    });
  });

  describe('Configuration Defaults', () => {
    test('provides valid port and service defaults', () => {
      assert.ok(typeof config.port === 'number');
      assert.ok(config.port > 0);
      assert.strictEqual(config.rateLimit.max, 10);
      assert.strictEqual(config.rateLimit.windowMs, 60000);
      assert.strictEqual(config.queue.name, 'click_events');
      assert.strictEqual(config.cache.ttl, 3600);
    });
  });
});

