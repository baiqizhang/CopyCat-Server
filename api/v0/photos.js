const express = require('express');
const router = new express.Router();
const models = require('../../database/models.js');
const bodyParser = require('body-parser');
const config = require('../../config.js');

/**
 * Bluebird made promise easy
 */
const Promise = require('bluebird');

/**
 * AWS service
 */
const AWS = require('aws-sdk');
AWS.config = new AWS.Config(config.credential);
const s3 = new AWS.S3();

/**
 * helper functions and objects
 */
const helper = require('./helper.js');
const assertHeader = helper.assertHeader;
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
 * compress image
 */
const gm = require('gm').subClass({
  imageMagick: true,
});


/**
 * Get a photo speficied by a photoId
 */
router.route('/:id')
.get((req, res) => {
  logReq(req.log, req);

  const id = req.params.id;
  // find photo by id
  models.Photo.findById(id)
    .populate({ path: 'ownerId' })
    // assure photo exists
    .then((photo) => {
      if (!photo) {
        const msg = 'Photo not found when get photo by id';
        req.log.warn(msg);
        errHandle.notFound(res, msg);
        throw new PromiseReject();
      }

      req.log.info({ photo }, 'Photo found');
      return photo;
    })
    // respond
    .then((photo) => {
      res.send(photo);
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
 * Post a photo given base64 image data
 */
// photo should no more than 5mb
router.use(bodyParser.json({
  limit: '5mb',
}));
router.route('/')
.post((req, res) => {
  logReq(req.log, req);

  assertHeader(req, res, req.log, 'content-type', 'application/json');

  // data is required
  let data = req.body.data;
  if (!data) {
    const msg = 'Missing data part in request.';
    req.log.error(msg);
    return errHandle.badRequest(res, msg);
  }
  data = new Buffer(data, 'base64');

  // ownerId is required
  let userPromise = null;
  let ownerId = req.body.ownerId;
  // If app provide ownerId, then search for the user
  if (ownerId) {
    // assert user exists
    userPromise = models.User.findById(ownerId).then((user) => {
      if (!user) {
        const msg = 'User does not exist';
        req.log.error(msg);
        errHandle.badRequest(res, msg);
        throw new PromiseReject();
      }
      return null;
    });
  } else {
  // Otherwise, use anonymous user
    userPromise = models.User.find({
      name: config.anonymousUserName,
    }).then((user) => {
      ownerId = user[0]._id;
      return null;
    });
  }

  // get photo size info
  function getSize() {
    return new Promise((resolve) => {
      gm(data, 'img')
      .size((err, size) => {
        if (err) throw err;
        req.log.info(size, 'Got size of new photo.');
        resolve(size);
      });
    });
  }

  function compressPhoto(size) {
    let width = size.width;
    let height = size.height;
    let newSize = {};
    if (width > config.maxWidth || height > config.maxHeight) {
      return new Promise((resolve) => {
        const widthScale = width / 800;
        const heightScale = height / 800;
        const scale = Math.max(widthScale, heightScale);
        width = Math.round(width / scale);
        height = Math.round(height / scale);

        gm(data, 'test.jpg')
        .setFormat('jpg')
        .resize(width, height)
        .toBuffer((err, buffer) => {
          if (err) throw err;
          newSize = { width, height };
          req.log.info(newSize, 'Compressed new photo.');
          resolve({ size: newSize, buffer });
        });
      });
    }
    return new Promise((resolve) => {
      gm(data, 'test.jpg')
      .toBuffer((err, buffer) => {
        if (err) throw err;
        req.log.info('No need to compress photo');
        resolve({ size, buffer });
      });
    });
  }

  // create a new empty photo(i.e. without imageUrl) in database to get photoId
  function createNewPhoto(sizeBuffer) {
    const size = sizeBuffer.size;
    const buffer = sizeBuffer.buffer;

    // create new photo
    const newPhoto = {};
    newPhoto.referenceId = req.body.referenceId;
    newPhoto.ownerId = ownerId;
    newPhoto.tagList = req.body.tagList;

    return models.Photo.create(newPhoto)
    .then((photo) => {
      if (!photo) {
        const msg = 'Create photo failed';
        req.log.warn(msg);
        errHandle.unknown(res, msg);
        throw new PromiseReject();
      }

      req.log.info({ photo }, 'Created new empty photo.');
      const id = `${photo._id}`;
      return { id, size, buffer };
    });
  }

  // upload new photo to AWS S3
  function uploadPhoto(idSizeBuffer) {
    const id = idSizeBuffer.id;
    const size = idSizeBuffer.size;
    const buffer = idSizeBuffer.buffer;

    const params = {
      Bucket: config.s3ImageBucket.name,
      Key: id,
      ACL: 'public-read',
      Body: buffer,
      ContentLength: buffer.length,
      ContentType: 'image/jpeg',
    };

    return new Promise((resolve) => {
      s3.upload(params)
      .send((err, d) => {
        if (err) throw err;
        req.log.info('Uploaded new photo to S3');
        const url = d.Location;
        resolve({ id, url, size });
      });
    });
  }

  // update photo in database
  function updatePhoto(idUrlSize) {
    const id = idUrlSize.id;
    const url = idUrlSize.url;
    const size = idUrlSize.size;

    return new Promise((resolve) => {
      models.Photo.findByIdAndUpdate(id,
        {
          $set: {
            imageUrl: url,
            width: size.width,
            height: size.height,
          },
        },
        {
          new: true,
        }, // set true to return modified data
        (err, photo) => {
          if (err) throw err;
          req.log.info({ photo }, 'Updated new photo.');
          resolve(photo);
        }
      );
    });
  }

  function populatePhoto(photo) {
    return models.Photo.populate(photo, { path: 'ownerId', model: 'User' });
  }

  // respond
  function respond(photo) {
    res.status(201);
    res.send(photo);
    logRes(req.log, res);
  }

  userPromise
  .then(getSize)
  .then(compressPhoto)
  .then(createNewPhoto)
  .then(uploadPhoto)
  .then(updatePhoto)
  .then(populatePhoto)
  .then(respond)
  .catch((err) => {
    if (!(err instanceof PromiseReject)) {
      req.log.error({ err }, 'Unknown error');
      errHandle.unknown(res, err);
    }
  });

  return null;
});

router.route('/like')
.post((req, res) => {
  logReq(req.log, req);

  const photoId = req.body.photoId;
  if (!photoId) {
    const msg = "Missing photoId";
    req.log.warn(msg);
    return errHandle.badRequest(res, msg);
  }
  let userId = req.body.userId;
  if (!userId) {
    userId = config.anonymousUserId;
  }

  // Update the photo user liked, to increment like number by 1.
  const photoUpdateLike = function photoUpdateLike(input) {
    const _photo = input.photo;
    const id = _photo._id;
    return new Promise((resolve) => {
      models.Photo.findByIdAndUpdate(id,
      // The inc operation would create like to be 1 if like
      // does not exist previously.
      { $inc: { like: 1 } },
      { new: true },
      (err, photo) => {
        if (err) throw err;
        req.log.info({ photo }, 'Photo got a new like.');
        resolve(photo);
      });
    });
  };

  // Update user data information, to push the photo to user's
  // like collection.
  // TODO: This data is better to be stored in a seperate database,
  // not the current monolithic one.
  const userUpdateLike = function userUpdateLike() {
    return null;
  };

  const merge = Promise.join(
    helper.assertUserExistById(userId),
    helper.assertPhotoExistById(photoId),
    (user, photo) => {
      const result = {};
      result.user = user[0];
      result.photo = photo[0];
      return result;
    });

  Promise.join(
    merge.then(photoUpdateLike),
    merge.then(userUpdateLike),
    () => {
      res.status(200).send();
      logRes(req.log, res);
    });
});

module.exports = router;
