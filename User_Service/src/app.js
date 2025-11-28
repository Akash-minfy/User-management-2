const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./lib/logger');
const userRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const { createDefaultAdmin } = require('./bootstrap/createDefaultAdmin');

const app = express();

// Basic middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiter  
const limiter = rateLimit({
windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || config.rateLimit.windowMs),
max: Number(process.env.RATE_LIMIT_MAX || config.rateLimit.max),
});
app.use(limiter);

// Routes
app.use('/api', userRoutes);
app.use('/api', rolesRoutes);

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', service: config.appName }));

// Connect to DB
mongoose.connect(process.env.MONGO_URI || config.mongoUri, {
useNewUrlParser: true,
useUnifiedTopology: true,
})
.then(async () => {
logger.info('Connected to MongoDB');
await createDefaultAdmin();
})
.catch(err => {
logger.error('MongoDB connection error', err);
process.exit(1);
});

module.exports = app;