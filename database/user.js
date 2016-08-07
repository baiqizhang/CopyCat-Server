const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const ObjectId = mongoose.Schema.ObjectId;

module.exports = mongoose.model('User',
  new mongoose.Schema({
    name: { type: String, required: true, index: true },
    profilePictureUrl: { type: String, required: true },
    time: { type: Date, default: Date.now, required: true },

    // Who follow this user.
    followers: [{ type: ObjectId, ref: 'User' }],
    // Who are this user follows.
    followees: [{ type: ObjectId, ref: 'User' }],

    // social network binding
    instagramId: { type: String, index: true },
  },
  { read: 'primaryPreferred' }
));
