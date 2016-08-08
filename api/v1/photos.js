const express = require('express');
const router = new express.Router();
const models = require('../../database/models.js');
const bodyParser = require('body-parser');
const config = require('../../config.js');
const Log = require('../../utils/logger.js');
const util = require('util');
const assertExist = require('../../utils/assertExist.js');

/**
 * Error handler and self-defined error class.
 */
const errLib = require('../../utils/error.js');
const errorHandler = errLib.errorHandler;
const DocumentNotFoundError = errLib.DocumentNotFoundError;
const BadRequestError = errLib.BadRequestError;

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
  const log = new Log(req, res);
  log.logReq();

  const id = req.params.id;
  // find photo by id
  models.Photo.findById(id)
    .populate({ path: 'ownerId' })
    // assure photo exists
    .then((photo) => {
      if (!photo || photo.length === 0) {
        const msg = util.format('Photo not found when get photo by id: %s', id);
        throw new DocumentNotFoundError(msg);
      }

      log.info({ photo }, 'Photo found');
      return photo;
    })
    // respond
    .then((photo) => {
      res.send(photo);
      log.logRes();
    })
    // error handling
    .catch((err) => {
      errorHandler.handle(err, log, res);
    });
});

/**
 * Post a photo given base64 image data
 */
// photo should no more than 5mb
router.use(bodyParser.json({
  limit: '5mb'
}));
router.route('/')
.post((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  // data is required
  let data = req.body.data;
  if (!data) {
    const msg = 'Missing data part in request.';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }
  data = new Buffer(data, 'base64');

  // If ownerId is provided, then we know who is user,
  // otherwise, we use anonymous user instead.
  let ownerId = req.body.ownerId;
  const userPromise = function userPromise() {
    if (ownerId) {
      return models.User.findById(ownerId).then((user) => {
        if (!user || user.length === 0) {
          const msg = util.format('User does not exist with ownerId: %s', ownerId);
          throw new BadRequestError(msg);
        }
        return ownerId;
      });
    }
    return models.User.find({
      name: config.anonymousUserName,
    }).then((user) => {
      ownerId = user[0]._id;
      return ownerId;
    });
  };

  // get photo size info
  function getSize() {
    return new Promise((resolve) => {
      gm(data, 'img')
      .size((err, size) => {
        if (err) throw err;
        log.info(size, 'Got size of new photo.');
        resolve(size);
      });
    });
  }

  function compressPhoto(size) {
    let width = size.width;
    let height = size.height;
    let newSize = {};
    // If photo size is too large, we compress it.
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
          log.info(newSize, 'Compressed new photo.');
          resolve({ size: newSize, buffer });
        });
      });
    }
    // Otherwise, we don't do anything about it.
    return new Promise((resolve) => {
      gm(data, 'test.jpg')
      .toBuffer((err, buffer) => {
        if (err) throw err;
        log.info('No need to compress photo');
        resolve({ size, buffer });
      });
    });
  }

  // Create a new empty photo(i.e. without imageUrl) in database to get photoId.
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
      if (!photo || photo.length === 0) {
        const msg = util.format('Create photo failed (maybe photo already exist): %j', newPhoto);
        throw new BadRequestError(msg);
      }

      log.info({ photo }, 'Created new empty photo.');
      const id = util.format('%s', photo._id);
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
        log.info('Uploaded new photo to S3.');
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
          new: true, // set true to return modified data
        },
        (err, photo) => {
          if (err) throw err;
          log.info({ photo }, 'Updated new photo.');
          resolve(photo);
        }
      );
    });
  }

  // Return photo with User information.
  function populatePhoto(photo) {
    return models.Photo.populate(photo, { path: 'ownerId', model: 'User' });
  }

  // respond
  function respond(photo) {
    res.status(201).send(photo);
    log.logRes();
  }

  userPromise()
  .then(getSize)
  .then(compressPhoto)
  .then(createNewPhoto)
  .then(uploadPhoto)
  .then(updatePhoto)
  .then(populatePhoto)
  .then(respond)
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });

  return null;
});

/**
 * Used to let users 'like' a photo.
 */
router.route('/like')
.post((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  const photoId = req.body.photoId;
  if (!photoId) {
    const msg = 'Missing photoId';
    return errorHandler.handle(new BadRequestError(msg), log, res);
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
        log.info({ photo }, 'Photo got a new like.');
        resolve(photo);
      });
    });
  };

  // Update user data information, to push the photo to user's
  // like collection.
  // TODO: This data is better to be stored in a seperate database,
  // not the current monolithic one.
  const userUpdateLike = function userUpdateLike(input) {
    return input.user;
  };

  // Assert both user and photo exist.
  const merge = Promise.join(
    assertExist.assertUserExistById(userId),
    assertExist.assertPhotoExistById(photoId),
    (user, photo) => {
      const result = {};
      result.user = user[0];
      result.photo = photo[0];
      return result;
    });

  Promise.join(
    merge.then(photoUpdateLike),
    merge.then(userUpdateLike),
    (photo, user) => {
      res.status(200).send({ photo, user });
      log.logRes();
    })
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });

  return null;
});

module.exports = router;
