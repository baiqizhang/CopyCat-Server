const express = require('express');
const router = new express.Router();
const models = require('../../database/models.js');
const ObjectId = require('mongodb').ObjectId;
const config = require('../../config.js');
const util = require('util');
const Promise = require('bluebird');
const Log = require('../../utils/logger.js');

const errLib = require('../../utils/error.js');
const errorHandler = errLib.errorHandler;
const DocumentNotFoundError = errLib.DocumentNotFoundError;

const getTimelineStyleQuery = Promise.promisify(
  require('../../utils/timelineHelper.js').getTimelineStyleQuery);

/**
 * Get timeline.
 * By default, it fetches at most 20 most recent timeline photos.
 *
 * Using count, maxId, sinceId, user could specify the photos
 * of different time, and number of photos, to be fetched.
 *
 * Specifically, this service will return photos within
 * (sinceId, maxId) of at most Min(200, count) photos
 */
router.route('/')
.get((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  // get query
  getTimelineStyleQuery({
    count: req.query.count,
    maxId: req.query.maxId,
    sinceId: req.query.sinceId,
  })
  // fetch timeline
  .then((queryCondition) => {
    const newQueryCondition = queryCondition;
    if (!req.query.secret || !req.query.secret === config.secret) {
      if (!newQueryCondition.range) {
        newQueryCondition.range = {};
      }
      newQueryCondition.range.ownerId = { $ne: new ObjectId(config.copycattestId) };
    }
    log.info(queryCondition);

    return models.Photo
    .find(queryCondition.range)
    .sort({ _id: -1 })
    .limit(queryCondition.count)
    .populate('ownerId');
  })
  // respond
  .then((photos) => {
    res.status(200).send(photos);
    log.logRes();
  })
  // error handling
  .catch((err) => {
    errorHandler.handle(err);
  });
});

/**
 * Get user's all followee's photos
 */
router.route('/:user')
.get((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  const name = req.params.user;

  const getFollowees = function getFollowees() {
    return models.User.find({ name })
    .then((user) => {
      if (!user || user.length === 0) {
        const msg = util.format('User %s not found', name);
        throw new DocumentNotFoundError(msg);
      }
      return user[0].followees;
    });
  };

  Promise.join(
    getTimelineStyleQuery({
      count: req.query.count,
      maxId: req.query.maxId,
      sinceId: req.query.sinceId,
    }),
    getFollowees(),
    (_queryCondition, followees) => {
      const queryCondition = _queryCondition;
      if (!queryCondition.range) {
        queryCondition.range = {};
      }
      if (!queryCondition.range.ownerId) {
        queryCondition.range.ownerId = {};
      }
      queryCondition.range.ownerId.$in = followees;
      return models.Photo
      .find(queryCondition.range)
      .sort({ _id: -1 })
      .limit(queryCondition.count)
      .populate('ownerId');
    })
    // respond
    .then((photos) => {
      res.status(200).send(photos);
      log.logRes();
    })
    // error handling
    .catch((err) => {
      errorHandler.handle(err, log, res);
    });
});

module.exports = router;
