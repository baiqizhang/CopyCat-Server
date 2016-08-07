const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
const ObjectId = mongoose.Schema.ObjectId;

module.exports = mongoose.model('Report',
  new mongoose.Schema({
    content: {
      reportType: { type: String, default: 'Default' },
      contentType: { type: String, required: true },
      contentId: { type: ObjectId, required: true },
    },
    reporter: {
      ownerId: { type: ObjectId, ref: 'User', required: true },
      reporterEmail: { type: String },
    },
    time: { type: Date, default: Date.now, required: true },
    state: { type: String, default: 'Issued' },
  },
  { read: 'primaryPreferred' }
  )
);

