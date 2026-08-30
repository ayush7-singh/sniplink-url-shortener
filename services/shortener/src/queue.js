const amqplib = require('amqplib');
const config = require('./config');

let channel = null;
let connection = null;

/**
 * Connect to RabbitMQ and create the click_events queue.
 */
async function connectQueue() {
  try {
    connection = await amqplib.connect(config.rabbitmqUrl);
    channel = await connection.createChannel();
    await channel.assertQueue(config.queue.name, {
      durable: true, // Queue survives broker restart
    });
    console.log(`[Queue] RabbitMQ connected, queue "${config.queue.name}" ready`);

    connection.on('close', () => {
      console.warn('[Queue] RabbitMQ connection closed, reconnecting in 5s...');
      setTimeout(connectQueue, 5000);
    });

    connection.on('error', (err) => {
      console.error('[Queue] RabbitMQ connection error:', err.message);
    });
  } catch (err) {
    console.error('[Queue] Failed to connect to RabbitMQ:', err.message);
    console.log('[Queue] Retrying in 5s...');
    setTimeout(connectQueue, 5000);
  }
}

/**
 * Publish a click event to the queue.
 * Fire-and-forget — does not block the caller.
 * @param {object} event - Click event payload
 */
function publishClickEvent(event) {
  if (!channel) {
    console.warn('[Queue] Channel not ready, dropping click event');
    return;
  }
  try {
    channel.sendToQueue(
      config.queue.name,
      Buffer.from(JSON.stringify(event)),
      { persistent: true } // Message survives broker restart
    );
  } catch (err) {
    console.error('[Queue] Failed to publish click event:', err.message);
  }
}

/**
 * Gracefully close the RabbitMQ connection.
 */
async function closeQueue() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch (err) {
    console.error('[Queue] Error closing connection:', err.message);
  }
}

module.exports = { connectQueue, publishClickEvent, closeQueue };
