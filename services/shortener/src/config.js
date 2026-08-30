require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  pg: {
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    database: process.env.PGDATABASE || 'urlshortener',
  },
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  rateLimit: {
    windowMs: 60 * 1000,
    max: 10,
  },
  cache: {
    ttl: 3600,
  },
  queue: {
    name: 'click_events',
  },
};

module.exports = config;
