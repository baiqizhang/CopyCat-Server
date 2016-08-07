const express = require('express');
const router = new express.Router();
const models = require('../../database/models.js');
const ObjectId = require('mongodb').ObjectId;
const config = require('../../config.js');
const util = require('util');
const Promise = require('bluebird');


/**
 * Helper functions.
 */
const helper = require('./helper.js');
const PromiseReject = helper.PromiseReject;
const errHandle = helper.errHandle;

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
  logReq(req.log, req);

  // get query
  helper.getTimelineStyleQuery({
    count: req.query.count,
    maxId: req.query.maxId,
    sinceId: req.query.sinceId,
  },
  req.log,
  res)

  // fetch timeline
  .then((queryCondition) => {
    const newQueryCondition = queryCondition;
    if (!req.query.secret || !req.query.secret === config.secret) {
      if (!newQueryCondition.range) {
        newQueryCondition.range = {};
      }
      newQueryCondition.range.ownerId = { $ne: new ObjectId(config.copycattestId) };
    }
    req.log.info(queryCondition);

    return models.Photo
    .find(queryCondition.range)
    .sort({ _id: -1 })
    .limit(queryCondition.count)
    .populate('ownerId');
  })

  // respond
  .then((photos) => {
    res.send(photos);
    logRes(req.log, res);
  })

  // error handling
  .catch((err) => {
    if (!(err instanceof PromiseReject)) {
      req.log.error({ err }, 'Unknown error');
      errHandle.unknown(res, err);
    }
  });
});

/**
 * Get user's all followee's photos
 */
router.route('/:user')
.get((req, res) => {
  logReq(req.log, req);

  const name = req.params.user;

  // get query condition
  const getQueryCondition = function getQueryCondition() {
    return helper.getTimelineStyleQuery({
      count: req.query.count,
      maxId: req.query.maxId,
      sinceId: req.query.sinceId,
    },
    req.log,
    res)
    .then((queryCondition) => {
      const newQueryCondition = queryCondition;
      if (!req.query.secret || (req.query.secret !== config.secret)) {
        if (!newQueryCondition.range) {
          newQueryCondition.range = {};
        }
        newQueryCondition.range.ownerId = { $ne: new ObjectId(config.copycattestId) };
      }
      req.log.info(queryCondition);
      return queryCondition;
    });
  };

  const getFollowees = function getFollowees() {
    return models.User.find({ name })
    .then((user) => {
      if (!user || user.length === 0) {
        const msg = util.format('User %s not found', name);
        req.log.warn(msg);
        errHandle.notFound(msg);
        throw new PromiseReject();
      }
      return user[0].followees;
    });
  };

  Promise.join(
    getQueryCondition(),
    getFollowees(),
    (oldQueryCondition, followees) => {
      const queryCondition = oldQueryCondition;
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
      res.send(photos);
      logRes(req.log, res);
    })
    // error handling
    .catch((err) => errHandle.promiseCatchHanler(res, req.log, err));
});


module.exports = router;
