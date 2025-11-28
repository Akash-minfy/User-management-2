const amqplib = require('amqplib');
const config = require('./config');
const logger = require('./logger');

let connection;
let channel;

async function getChannel() {
  if (channel) return channel;
  connection = await amqplib.connect(config.mq.url);
  connection.on('error', (err) => logger.error('RabbitMQ connection error', err));
  connection.on('close', () => logger.warn('RabbitMQ connection closed'));
  channel = await connection.createChannel();
  await channel.assertQueue(config.mq.emailQueue, { durable: true });
  return channel;
}

async function publishEmailJob(payload) {
  const ch = await getChannel();
  const buffer = Buffer.from(JSON.stringify(payload));
  const ok = ch.sendToQueue(config.mq.emailQueue, buffer, { persistent: true, contentType: 'application/json' });
  if (!ok) logger.warn('RabbitMQ sendToQueue returned false');
}

module.exports = { getChannel, publishEmailJob };


