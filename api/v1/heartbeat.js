const express = require('express');
const router = new express.Router();
const Log = require('../../utils/logger.js');

/**
 * Heartbeat request.
 */
router.route('/')
.get((req, res) => {
  const log = new Log(req, res);
  log.info('heartbeat');
  res.send();
});

module.exports = router;
