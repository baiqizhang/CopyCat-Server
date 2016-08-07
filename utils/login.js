const models = require('../database/models.js');
const util = require('util');

/**
 * Generic login mechanism.
 *
 * userInfo: Used to search a user in our database.
 * defaultUserInfo: Used to create a user in our database if
 *                  previous search failed.
 * callback: User registered function to give controll back to
 *           caller after search user.
 */
const login = function login(userInfo, defaultUserInfo, callback) {
  // Find user if it exists
  models.User.find(userInfo)
  .then((user) => {
    if (!user || user.length === 0) {
      return models.User.create(defaultUserInfo);
    }
    return user;
  })
  // Assert user create succeed and return
  .then((user) => {
    if (!user || user.length === 0) {
      callback(new Error(util.format('Create copycat user %j failed', defaultUserInfo)), null);
    } else {
      callback(null, user[0]);
    }
  })
  // error handling
  .catch((err) => { callback(err); });
};

/**
 * Let instagram user login. We save a corresponding copycat user in our
 * database using instagram user id as key. If no such user exist, we create
 * a user for him/her.
 */
const instagram = function instagram(instagramInfo, callback) {
  const instagramUser = instagramInfo.user;
  const defaultUserInfo = {
    name: instagramUser.username,
    profilePictureUrl: instagramUser.profile_picture,
    instagramId: instagramUser.id,
  };

  login(instagramInfo, defaultUserInfo, callback);
};


module.exports.instagram = instagram;
