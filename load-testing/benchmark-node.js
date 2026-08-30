#!/usr/bin/env node

/**
 * SnipLink High-Concurrency Benchmark Runner
 * Zero-dependency Node.js HTTP load generator
 */

const http = require('http');

const URL_TO_TEST = process.env.TARGET_URL || 'http://localhost:3001/healthz';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '25', 10);
const DURATION_SECONDS = parseInt(process.env.DURATION || '10', 10);

console.log('='.repeat(60));
console.log(`🚀 SnipLink Concurrency Benchmark`);
console.log(`🎯 Target:      ${URL_TO_TEST}`);
console.log(`👥 Concurrency: ${CONCURRENCY} workers`);
console.log(`⏱️  Duration:    ${DURATION_SECONDS}s`);
console.log('='.repeat(60));

const latencies = [];
let successful = 0;
let failed = 0;
let running = true;

const url = new URL(URL_TO_TEST);
const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY });

function makeRequest(workerId) {
  if (!running) return;

  const start = process.hrtime();
  const req = http.get(
    {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      agent,
      headers: { Connection: 'keep-alive' },
    },
    (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const [sec, nano] = process.hrtime(start);
        const ms = sec * 1000 + nano / 1e6;
        latencies.push(ms);

        if (res.statusCode >= 200 && res.statusCode < 400) {
          successful++;
        } else {
          failed++;
        }

        if (running) setImmediate(() => makeRequest(workerId));
      });
    }
  );

  req.on('error', (err) => {
    failed++;
    if (running) setImmediate(() => makeRequest(workerId));
  });

  req.setTimeout(5000, () => {
    req.destroy();
  });
}

// Start workers
const startTime = Date.now();
for (let i = 0; i < CONCURRENCY; i++) {
  makeRequest(i);
}

// End test after duration
setTimeout(() => {
  running = false;
  const totalDurationSec = (Date.now() - startTime) / 1000;

  latencies.sort((a, b) => a - b);
  const total = latencies.length;

  if (total === 0) {
    console.log('\n❌ No requests completed.');
    process.exit(1);
  }

  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const mean = sum / total;
  const p50 = latencies[Math.floor(total * 0.5)];
  const p90 = latencies[Math.floor(total * 0.9)];
  const p95 = latencies[Math.floor(total * 0.95)];
  const p99 = latencies[Math.floor(total * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const rps = (total / totalDurationSec).toFixed(2);

  console.log('\n📊 Benchmark Results:');
  console.log(`   Total Requests:    ${total}`);
  console.log(`   Successful:        ${successful}`);
  console.log(`   Failed / Non-2xx:  ${failed}`);
  console.log(`   Throughput (RPS):  ${rps} req/sec`);
  console.log('\n⏱️  Latency Distribution:');
  console.log(`   Min:               ${min.toFixed(2)} ms`);
  console.log(`   Mean:              ${mean.toFixed(2)} ms`);
  console.log(`   P50:               ${p50.toFixed(2)} ms`);
  console.log(`   P90:               ${p90.toFixed(2)} ms`);
  console.log(`   P95:               ${p95.toFixed(2)} ms`);
  console.log(`   P99:               ${p99.toFixed(2)} ms`);
  console.log(`   Max:               ${max.toFixed(2)} ms`);
  console.log('='.repeat(60));
  process.exit(0);
}, DURATION_SECONDS * 1000);
