'use strict';

var express = require("express");
var router = express.Router();

/**
 * helper functions and objects
 */
var helper = require("./helper.js");

/**
 * log objects and functions
 */
var logReqIdMiddleware = helper.logReqIdMiddleware;

/**
 * Add reqId to each request
 */
router.use(logReqIdMiddleware);

/**
 * Heartbeat request.
 */
router.route('/')
.get(function(req, res) {
  req.log.info("heartbeat");
  res.send();
});

module.exports = router;
