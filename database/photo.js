const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const ObjectId = mongoose.Schema.ObjectId;

module.exports = mongoose.model('Photo',
  new mongoose.Schema({
    imageUrl: { type: String },
    referenceId: { type: ObjectId, ref: 'Photo' },
    ownerId: { type: ObjectId, ref: 'User', required: true },
    tagList: [String],
    time: { type: Date, default: Date.now, required: true },
    height: { type: Number },
    width: { type: Number },
    like: { type: Number, default: 0 },
  },
  { read: 'primaryPreferred' }
  )
);
