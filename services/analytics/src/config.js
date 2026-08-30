require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3002,
  pg: {
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    database: process.env.PGDATABASE || 'urlshortener',
  },
  databaseUrl: process.env.DATABASE_URL,
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  queue: {
    name: 'click_events',
  },
};

module.exports = config;
