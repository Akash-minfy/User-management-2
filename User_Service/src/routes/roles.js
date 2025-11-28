const express = require('express');
const config = require('../config');

const router = express.Router();

// GET /api/roles -> list all roles in priority order (highest first)
router.get('/roles', (_req, res) => {
  res.json({ roles: config.roleHierarchy });
});

module.exports = router;

