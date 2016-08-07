const express = require('express');
const router = new express.Router();
const models = require('../../database/models.js');
const bodyParser = require('body-parser');
const Log = require('../../utils/logger.js');
const util = require('util');

const errLib = require('../../utils/error.js');
const errorHandler = errLib.errorHandler;
const BadRequestError = errLib.BadRequestError;

/**
 * Post a report.
 * { content: {
 *     reportType: "optional",
 *     contentType: "photo",
 *     contentId: "5776172ef71f0029f517ab6a",
 *   },
 *   reporter: {
 *     ownerId: "574b49b6543e91100034764b",
 *     reporterEmail: "optional",
 *   },
 *   time: "DONOT SET THIS FIELD",
 *   status: "DONOT SET THIS FIELD",
 * }
 */
router.use('/', bodyParser.json());
router.route('/')
.post((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  const body = req.body;
  if (!body ||
      !body.content ||
      !body.content.contentType ||
      !body.content.contentId ||
      !body.reporter ||
      !body.reporter.ownerId) {
    const msg = 'Missing field in request';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  body.content.contentType = body.content.contentType.toLowerCase();
  if (body.content.contentType !== 'photo') {
    const msg = util.format(
      'content.contentType should be one of [photo], but is: %s', body.content.contentType);
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  if (body.reporter.reporterEmail) {
    body.reporter.reporterEmail = body.reporter.reporterEmail.toLowerCase();
  }
  if (body.state || body.time) {
    const msg = 'Do not include status or time in your request';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  models.Report.create(req.body)
  .then((report) => {
    if (!report || report.length === 0) {
      const msg = util.format('Create report failed: %j', req.body);
      throw new BadRequestError(msg);
    }
    return report;
  })
  .then((report) => {
    res.status(201).send(report);
    log.info({ report }, 'Report created');
  })
  // error handler
  .catch((err) => {
    errorHandler.handle(err);
  });

  return null;
});

module.exports = router;
