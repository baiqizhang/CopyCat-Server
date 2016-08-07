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
 * Get a specific album.
 */
router.route('/:id')
.get((req, res) => {
  logReq(req.log, req);

  // find album using id
  const id = req.params.id;
  models.Album.findById(id)
  .populate({
      path: 'photoIdList',
      populate: {
          path: 'ownerId',
          model: 'User',
      },
  })
  .populate('ownerId')
  // assure album exist, and populate user in photos
  .then((album) => {
    if (!album) {
      const msg = 'Album not found using id ' + id;
      req.log.warn(msg);
      errHandle.notFound(res, msg);
      throw new PromiseReject();
    }
    return album;
  })
  // respond
  .then((album) => {
    res.send(album);
    req.log.info({ album }, 'Get album.');
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
 * Post a new album
 */
router.use('/', bodyParser.json());
router.route('/')
.post((req, res) => {
  logReq(req.log, req);

  var userPromise = null;
  var ownerId = req.body.ownerId;
  if(ownerId) {
      // assert user exists
      userPromise = 
        models.User.findById(ownerId).then((user) => {
            if(!user) {
               var msg = "User does not exist";
               req.log.error(msg);
               errHandle.badRequest(res, msg);
               throw new PromiseReject();
            }

            return user._id;
        });
  }
  else {
      userPromise = 
        models.User.find({ 'name' : 'anonymous' }).then((user) => {
            return user[0]._id;
        });
  }

  userPromise

  //album infomation
  .then((ownerId) => {
    var data = {};
    data.name = req.body.name;
    data.imageUrl = req.body.imageUrl;
    data.photoIdList = req.body.photoIdList;
    data.tagList = req.body.tagList;
    data.ownerId = ownerId

    return models.Album.create(data);
  })

  //assure album exist
  .then(function assureAlbumExist(album) {
    if(!album) {
      var msg = "Create album failed";
      req.log.warn(msg);
      errHandle.badRequest(res, msg);
      throw new PromiseReject();
    }

    return models.Album.populate(album, {path: 'ownerId', model: 'User'});
  })

  //respond
  .then((album) => {
    res.statusCode = 201;
    res.send(album);
    req.log.info({album:album}, "Album created");
    logRes(req.log, res);
  })

  //error handler
  .catch(function(err) {
    if(!(err instanceof PromiseReject)) {
      req.log.error({err:err}, "Unknown error");
      errHandle.unknown(res, err);
    }
  });
});

module.exports = router;
