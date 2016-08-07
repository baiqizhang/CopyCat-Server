const express = require('express');
const router = new express.Router();
const models = require('../../database/models.js');
const bodyParser = require('body-parser');
const config = require('../../config.js');
const util = require('util');

/**
 * Helper functions
 */
const helper = require('./helper.js');
const errHandle = helper.errHandle;
const PromiseReject = helper.PromiseReject;

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
 * Get all users.
 */
router.route('/all')
.get((req, res) => {
  logReq(req.log, req);

  models.User.find()
  // respond
  .then((user) => {
    res.send(user);
    req.log.info({ user }, 'Get all users.');
    logRes(req.log, res);
  })
  .catch((err) => {
    if (!(err instanceof PromiseReject)) {
      req.log.error({ err }, 'Unknown error');
      errHandle.unknown(res, err);
    }
  });
});

/**
 * Get a specific user.
 */
router.route('/:id')
.get((req, res) => {
  logReq(req.log, req);

  // find user using id
  const id = req.params.id;
  models.User.findById(id)
  // assure user exist
  .then((user) => {
    if (!user) {
      const msg = `User not found using id ${id}`;
      req.log.warn(msg);
      errHandle.notFound(res, msg);
      throw new PromiseReject();
    }
    return user;
  })
  // respond
  .then((user) => {
    res.send(user);
    req.log.info({ user }, 'Get user.');
    logRes(req.log, res);
  })
  .catch((err) => {
    if (!(err instanceof PromiseReject)) {
      req.log.error({ err }, 'Unknown error');
      errHandle.unknown(res, err);
    }
  });
});

/**
 * Get all photos by this user.
 */
router.route('/:user/photos')
.get((req, res) => {
  logReq(req.log, req);

  const name = req.params.user;
  models.User.find({ name })
  // assure user exist
  .then((user) => {
    if (!user || user.length === 0) {
      const msg = util.format('User not found using name %s', name);
      req.log.warn(msg);
      errHandle.notFound(res, msg);
      throw new PromiseReject();
    }
    return user[0]._id;
  })
  // Find photos using user id
  .then((id) => models.Photo.find({ ownerId: id }))
  // respond
  .then((photos) => {
    res.send(photos);
    req.log.info({ photos }, 'Get photos.');
    logRes(req.log, res);
  })
  .catch((err) => errHandle.promiseCatchHanler(res, req.log, err));
});

/**
 * Follow a user.
 */
router.route('/:follower/follow/:followee')
.get((req, res) => {
  logReq(req.log, req);

  const follower = req.params.follower;
  const followee = req.params.followee;
  let followerId = null;
  let followeeId = null;

  // Assert two users exist.
  models.User.find({ $or:
  [
    { name: follower },
    { name: followee },
  ] })
  .then((users) => {
    if (!users || users.length !== 2) {
      const msg = util.format('User %s or %s does not exist', follower, followee);
      req.log.warn(msg);
      errHandle.notFound(res, msg);
      throw new PromiseReject();
    }
    req.log.info('Found two user');
    return users;
  })
  // Assert follow relationship don't exist.
  .then((users) => {
    const followerUser = users[0].name === follower ? users[0] : users[1];
    const followeeUser = users[0].name === followee ? users[0] : users[1];
    followerId = followerUser._id;
    followeeId = followeeUser._id;
    req.log.info({ follower, followee, followerId, followeeId }, 'User info');
    const followerUserFollowees = followerUser.followees.filter(
      (user) => String(user) === String(followeeId));
    const followeeUserFollowers = followeeUser.followers.filter(
      (user) => String(user) === String(followerId));
    if (followerUserFollowees.length !== 0 || followeeUserFollowers.length !== 0) {
      const msg = util.format('User %s and %s already have follow relationship',
                              follower, followee);
      req.log.warn(msg);
      errHandle.badRequest(res, msg);
      throw new PromiseReject();
    }
    req.log.info('Make sure these two users dont have follow relationship before');
    return null;
  })
  // Update followee -> follower
  .then(() =>
    models.User.update(
      { name: followee },
      { $push: { followers: followerId } }
    ))
  // Update follower -> followee, and return updated follower
  .then(() =>
    models.User.findByIdAndUpdate(followerId,
      { $push: { followees: followeeId } },
      { new: true }
    ))
  // respond
  .then((followerUser) => {
    res.status(201);
    res.send(followerUser);
    req.log.info('Follow relationship updated.');
    logRes(req.log, res);
  })
  .catch((err) => errHandle.promiseCatchHanler(res, req.log, err));
});

/**
 * Post a new user
 */
router.use('/', bodyParser.json());
router.route('/')
.post((req, res) => {
  logReq(req.log, req);

  // User name must provided
  const name = req.body.name;
  if (!name) {
    const msg = 'Missing user name';
    req.log.info(msg);
    errHandle.badRequest(res, msg);
  }

  // Profile picture url could be default
  const profilePictureUrl = req.body.profilePictureUrl ?
    req.body.profilePictureUrl :
    config.anonymousProfilePictureUrl;
  if (!profilePictureUrl) {
    const msg = 'Missing user profile';
    req.log.info(msg);
    errHandle.badRequest(res, msg);
  }

  // User name must be unique
  models.User.find({ name })
  .then((user) => {
    if (user && user.length > 0) {
      const msg = `User ${name} already exist`;
      req.log.info(msg);
      errHandle.badRequest(res, msg);
      throw new PromiseReject();
    }
    return null;
  })
  // Create user
  .then(() =>
    models.User.create({ name, profilePictureUrl })
  )
  // Assure user create succeed
  .then((user) => {
    if (!user) {
      const msg = 'Create user failed';
      req.log.warn(msg);
      errHandle.badRequest(res, msg);
      throw new PromiseReject();
    }
    return user;
  })
  // Respond
  .then((user) => {
    res.status(201);
    res.send(user);
    req.log.info({ user }, 'User created');
    logRes(req.log, res);
  })
  // Error handler
  .catch((err) => {
    if (!(err instanceof PromiseReject)) {
      req.log.error({ err }, 'Unknown error');
      errHandle.unknown(res, err);
    }
  });
});

module.exports = router;
