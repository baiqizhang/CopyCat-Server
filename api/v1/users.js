const express = require('express');
const router = new express.Router();
const models = require('../../database/models.js');
const bodyParser = require('body-parser');
const util = require('util');
const Log = require('../../utils/logger.js');

/**
 * Error handler and self-defined error class.
 */
const errLib = require('../../utils/error.js');
const errorHandler = errLib.errorHandler;
const DocumentNotFoundError = errLib.DocumentNotFoundError;
const BadRequestError = errLib.BadRequestError;
const UnknownError = errLib.UnknownError;

/**
 * Get all users.
 */
router.route('/all')
.get((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  models.User.find()
  // respond
  .then((user) => {
    res.send(user);
    log.info({ user }, 'Get all users.');
  })
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });
});

/**
 * Get a specific user.
 */
router.route('/:id')
.get((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  // find user using id
  const id = req.params.id;
  models.User.findById(id)
  // assure user exist
  .then((user) => {
    if (!user || user.length === 0) {
      const msg = util.format('User not found using id: %s', id);
      throw new DocumentNotFoundError(msg);
    }
    return user;
  })
  // respond
  .then((user) => {
    res.status(200).send(user);
    log.info({ user }, 'Get user.');
  })
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });
});

/**
 * Get all photos by this user.
 */
router.route('/:user/photos')
.get((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  const name = req.params.user;
  models.User.find({ name })
  // assure user exist
  .then((user) => {
    if (!user || user.length === 0) {
      const msg = util.format('User not found using name %s', name);
      throw new DocumentNotFoundError(msg);
    }
    return user[0]._id;
  })
  // Find photos using user id
  .then((id) => models.Photo.find({ ownerId: id }))
  // respond
  .then((photos) => {
    res.send(photos);
    log.info({ photos }, 'Get photos.');
  })
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });
});

/**
 * Follow a user.
 */
router.route('/:follower/follow/:followee')
.get((req, res) => {
  const log = new Log(req, res);
  log.logReq();

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
      throw new DocumentNotFoundError(msg);
    }
    log.info({ users }, 'Found two user');
    return users;
  })
  // Assert follow relationship don't exist.
  .then((users) => {
    const followerUser = users[0].name === follower ? users[0] : users[1];
    const followeeUser = users[0].name === followee ? users[0] : users[1];
    followerId = followerUser._id;
    followeeId = followeeUser._id;
    log.info({ follower, followee, followerId, followeeId }, 'User info');
    const followerUserFollowees = followerUser.followees.filter(
      (user) => String(user) === String(followeeId));
    const followeeUserFollowers = followeeUser.followers.filter(
      (user) => String(user) === String(followerId));

    if (followerUserFollowees.length !== 0 || followeeUserFollowers.length !== 0) {
      const msg = util.format('User %s and %s already have follow relationship',
                              follower, followee);
      throw new BadRequestError(msg);
    }
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
    res.status(201).send(followerUser);
    log.info('Follow relationship updated.');
  })
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });
});

/**
 * Post a new user
 */
router.use('/', bodyParser.json());
router.route('/')
.post((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  // User name must provided
  const name = req.body.name;
  if (!name) {
    const msg = 'Missing name field';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  // Profile picture url could be default
  const profilePictureUrl = req.body.profilePictureUrl;
  if (!profilePictureUrl) {
    const msg = 'Missing profilePictureUrl field';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  // User name must be unique
  models.User.find({ name })
  .then((user) => {
    if (user && user.length > 0) {
      const msg = util.format('User already exist: %s', name);
      return errorHandler.handle(new BadRequestError(msg), log, res);
    }
    return null;
  })
  // Create user
  .then(() =>
    models.User.create({ name, profilePictureUrl })
  )
  // Assure user create succeed
  .then((user) => {
    if (!user || user.length === 0) {
      const msg = 'Create user failed';
      throw new UnknownError(msg);
    }
    return user;
  })
  // Respond
  .then((user) => {
    res.status(201).send(user);
    log.info({ user }, 'User created');
  })
  // Error handler
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });

  return null;
});

module.exports = router;
