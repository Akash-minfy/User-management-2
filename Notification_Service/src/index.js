require('dotenv').config();
const app = require('./server');
const config = require('./lib/config');
const logger = require('./lib/logger');
const rabbit = require('./lib/rabbit');

const PORT = process.env.PORT || config.port || 5001;
const ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  logger.info(`Notification Service running in ${ENV} on port ${PORT}`);
});

// Initialize RabbitMQ channel on startup (non-fatal)
(async () => {
  try {
    await rabbit.getChannel();
    logger.info('RabbitMQ channel ready');
  } catch (err) {
    console.warn('RabbitMQ not available at startup; will use direct mail fallback');
  }
})();


