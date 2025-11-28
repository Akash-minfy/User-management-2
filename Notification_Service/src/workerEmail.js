require('dotenv').config();
const rabbit = require('./lib/rabbit');
const config = require('./lib/config');
const logger = require('./lib/logger');
const mailer = require('./lib/mailer');

(async () => {
  try {
    const ch = await rabbit.getChannel();
    logger.info(`Email worker consuming from queue ${config.mq.emailQueue}`);

    await ch.consume(config.mq.emailQueue, async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        const { to, subject, html, text } = content;
        await mailer.sendMail({ to, subject, html, text });
        ch.ack(msg);
      } catch (err) {
        logger.error('Failed to process email job', err);
        // requeue once; otherwise, send to dead-letter if configured
        const redelivered = msg.fields.redelivered;
        if (redelivered) {
          ch.nack(msg, false, false);
        } else {
          ch.nack(msg, false, true);
        }
      }
    }, { noAck: false });
  } catch (err) {
    logger.error('Email worker failed to start', err);
    process.exit(1);
  }
})();


