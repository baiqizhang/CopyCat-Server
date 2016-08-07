const util = require('util');
const models = require('../database/models.js');

const errLib = require('./error.js');
const DocumentNotFoundError = errLib.DocumentNotFoundError;

/**
 * Assert each id exist for corresponding database.
 */
const assertExistById = function assertExistById(model, idList, message) {
  return model.find({ $or: idList })
    .then((result) => {
      if (result === null || result.length !== idList.length) {
        throw new DocumentNotFoundError(message);
      }
      return result;
    });
};

const assertUsersExistById = function assertUsersExistById(userIdList) {
  return assertExistById(models.User, userIdList,
  util.format('Not all users exist in user id list: %j.', userIdList));
};

const assertUserExistById = function assertUserExistById(userId) {
  const userIdList = [{ _id: userId }];
  return assertUsersExistById(userIdList);
};

const assertPhotosExistById = function assertPhotosExistById(photoIdList) {
  return assertExistById(models.Photo, photoIdList,
  'Not all photos exist in user id list.');
};

const assertPhotoExistById = function assertPhotoExistById(photoId) {
  const photoIdList = [{ _id: photoId }];
  return assertPhotosExistById(photoIdList);
};

module.exports.assertUsersExistById = assertUsersExistById;
module.exports.assertUserExistById = assertUserExistById;
module.exports.assertPhotosExistById = assertPhotosExistById;
module.exports.assertPhotoExistById = assertPhotoExistById;

