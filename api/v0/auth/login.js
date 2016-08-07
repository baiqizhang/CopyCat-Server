const models = require('../../../database/models.js');
const sprintf = require('sprintf-js').sprintf;

function instagram(instagramInfo, callback) {
  const instagramUser = instagramInfo.user;
  let copycatUser = null;

  // Create new user or return exist user
  let needCreate = false;

  // Find user if it exists
  models.User.find({ instagramId: instagramUser.id })
  .then((user) => {
    if (!user || user.length === 0) {
      copycatUser = {
        name: instagramUser.username,
        profilePictureUrl: instagramUser.profile_picture,
        instagramId: instagramUser.id,
      };
      needCreate = true;
    } else {
      copycatUser = user[0];// only one user could exist
      needCreate = false;
    }

    return copycatUser;
  })
  // Create user if necessary
  .then((user) => {
    if (needCreate) {
      return models.User.create(user);
    }
    return user;
  })
  // Assert user create succeed and return
  .then((user) => {
    if (!user) {
      callback(new Error(sprintf('create copycat user %j failed', copycatUser)), null);
    } else {
      callback(null, {
        instagram: instagramInfo,
        copycat: user,
      });
    }
  })
  // error handling
  .catch((err) => { callback(err); });
}

module.exports.instagram = instagram;
