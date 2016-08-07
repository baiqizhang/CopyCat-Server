const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const ObjectId = mongoose.Schema.ObjectId;

module.exports = mongoose.model('Album',
  new mongoose.Schema({
    name: { type: String, required: true },
    imageUrl: { type: String, required: true },
    photoIdList: [{ type: ObjectId, ref: 'Photo' }],
    ownerId: { type: ObjectId, ref: 'User', required: true },
    tagList: [String],
    time: { type: Date, default: Date.now, required: true },
  },
  { read: 'primaryPreferred' }
  )
);

