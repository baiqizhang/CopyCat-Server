const util = require('util');
const config = require('../config.js');

const errLib = require('./error.js');
const BadRequestError = errLib.BadRequestError;

/**
 * Timeline style query parameters
 */
module.exports.getTimelineStyleQuery = function getTimelineStyleQuery(query, callback) {
  const queryCondition = {};

  // Get query count.
  const count = query.count;
  if (count && isNaN(parseInt(count, 10))) {
    const msg = util.format('Count should be numeric but is: %s', count);
    callback(new BadRequestError(msg), null);
    return null;
  }
  if (count) {
    queryCondition.count = Math.min(parseInt(count, 10), config.timelineQueryMaxCount);
  } else {
    queryCondition.count = config.timelineQueryDefaultCount;
  }

  // Get query maxId.
  const maxId = query.maxId;
  if (maxId) {
    if (!queryCondition.range || !queryCondition.range._id) {
      queryCondition.range = {};
      queryCondition.range._id = {};
    }
    queryCondition.range._id.$lt = maxId;
  }

  // Get query sinceId.
  const sinceId = query.sinceId;
  if (sinceId) {
    if (!queryCondition.range || !queryCondition.range._id) {
      queryCondition.range = {};
      queryCondition.range._id = {};
    }
    queryCondition.range._id.$gt = sinceId;
  }

  callback(null, queryCondition);
  return null;
};
