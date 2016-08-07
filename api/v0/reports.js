const express = require('express');
const router = new express.Router();
const models = require('../../database/models.js');
const bodyParser = require('body-parser');

/**
 * Helper functions
 */
const helper = require('./helper.js');
const errHandle = helper.errHandle;
const PromiseReject = helper.PromiseReject;
const assertExist = helper.assertExist;

/**
 * log objects and functions
 */
const logReq = helper.logReq;
const logRes = helper.logRes;
const logReqIdMiddleware = helper.logReqIdMiddleware;

/**
 * Add reqId to each request
 */
router.use(logReqIdMiddleware);

/**
 * Post a report
 */
router.use('/', bodyParser.json());
router.route('/')
.post((req, res) => {
  logReq(req.log, req);

  const body = req.body;
  if (!assertExist(body.content, 'content', res) ||
      !assertExist(body.content.contentType, 'content.contentType', res) ||
      !assertExist(body.content.contentId, 'content.contentId', res) ||
      !assertExist(body.reporter, 'reporter', res) ||
      !assertExist(body.reporter.ownerId, 'reporter.ownerId', res)
  ) {
    req.log.info('Missing field in request');
    return null;
  }

  if (body.content.contentType) {
    body.content.contentType = body.content.contentType.toLowerCase();
  }
  if (body.content.contentType !== 'photo' && body.content.contentType !== 'album') {
    const msg = 'content.contentType should be one of [photo ,album], but is ' + body.content.contentType;
    req.log.info(msg);
    return errHandle.badRequest(res, msg);
  }

  if (body.reporter.reporterEmail) {
    body.reporter.reporterEmail = body.reporter.reporterEmail.toLowerCase();
  }
  if (body.state || body.time) {
    return errHandle.badRequest('Do not include status or time in your request');
  }

  models.Report.create(req.body)
  .then((report) => {
    if (!report) {
      const msg = 'Create report failed';
      req.log.warn(msg);
      errHandle.badRequest(res, msg);
      throw new PromiseReject();
    }
    return report;
  })
  .then((report) => {
    res.statusCode = 201;
    res.send(report);
    req.log.info({ report }, 'Report created');
    logRes(req.log, res);
  })

  // error handler
  .catch((err) => {
    if (!(err instanceof PromiseReject)) {
      req.log.error({ err }, 'Unknown error');
      errHandle.unknown(res, err);
    }
  });

  return null;
});

module.exports = router;
