require('dotenv').config();
const app = require('./app');
const config = require('./config');
const logger = require('./lib/logger');

const PORT = process.env.PORT || config.port || 4000;
const ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
// logger.info(`User Service running in ${process.env.NODE_ENV} on port ${PORT}`);
logger.info(`User Service running in ${ENV} on port ${PORT}`);
}); 