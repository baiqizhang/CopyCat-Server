const mongoose = require('mongoose');
const config = require('../config.js');
const util = require('util');

const replicationSetMember = config.replicaAddr;
console.log('connecting to databases: ' + replicationSetMember);
let mongodbUrl = 'mongodb://';
for (let i = 0; i < replicationSetMember.length; ++i) {
  mongodbUrl = util.format('%s,%s', mongodbUrl, replicationSetMember[i]);
}
mongodbUrl = util.format('%s/%s', mongodbUrl, config.databaseName);
mongoose.connect(mongodbUrl, {
    replset: {
      strategy: config.replicationSetStrategy,
      rs_name: config.replicationSetName,
  }
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
module.exports = db;
