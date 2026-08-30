const amqplib = require('amqplib');
const config = require('./config');
const { pool } = require('./db');
const { eventsConsumedTotal } = require('./metrics');

let channel = null;
let connection = null;

/**
 * Connect to RabbitMQ and start consuming click events.
 */
async function startConsumer() {
  try {
    connection = await amqplib.connect(config.rabbitmqUrl);
    channel = await connection.createChannel();
    await channel.assertQueue(config.queue.name, { durable: true });

    // Process one message at a time for reliable delivery
    channel.prefetch(1);

    console.log(`[Consumer] Listening on queue "${config.queue.name}"...`);

    channel.consume(config.queue.name, async (msg) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString());

        // Insert click event into analytics table
        await pool.query(
          `INSERT INTO click_events (short_code, clicked_at, referrer, user_agent, ip_address)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            event.shortCode,
            event.timestamp || new Date().toISOString(),
            event.referrer || null,
            event.userAgent || null,
            event.ip || null,
          ]
        );

        eventsConsumedTotal.inc({ status: 'success' });

        // Acknowledge message after successful processing
        channel.ack(msg);
      } catch (err) {
        eventsConsumedTotal.inc({ status: 'failure' });
        console.error('[Consumer] Failed to process message:', err.message);
        // Negative acknowledge — requeue the message for retry
        channel.nack(msg, false, true);
      }
    });

    connection.on('close', () => {
      console.warn('[Consumer] RabbitMQ connection closed, reconnecting in 5s...');
      setTimeout(startConsumer, 5000);
    });

    connection.on('error', (err) => {
      console.error('[Consumer] RabbitMQ error:', err.message);
    });
  } catch (err) {
    console.error('[Consumer] Failed to connect:', err.message);
    console.log('[Consumer] Retrying in 5s...');
    setTimeout(startConsumer, 5000);
  }
}

/**
 * Gracefully close the consumer connection.
 */
async function closeConsumer() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch (err) {
    console.error('[Consumer] Error closing connection:', err.message);
  }
}

module.exports = { startConsumer, closeConsumer };
