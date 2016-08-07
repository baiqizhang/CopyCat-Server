const CastError = require('mongoose').CastError;
const models = require('../../database/models.js');
const sprintf = require('sprintf-js').sprintf;

/**
 * PromiseReject, used in Promise chain to as reject method.
 *
 * @Deprecated Use PromiseRejectError class instead.
 */
const PromiseReject = function PromiseReject(err, message) {
  this.err = err;
  this.name = 'MyError';
  this.message = message;
  this.stack = (new Error()).stack;
};
PromiseReject.prototype = new Error;
module.exports.PromiseReject = PromiseReject;

/**
 * A customized Error that is used in Promise chain.
 * So that we could throw this Error to break out of Promise chain.
 *
 * This piece of code is took from:
 * http://stackoverflow.com/questions/31089801/extending-error-in-javascript-with-es6-syntax
 *
 * For now I'm not pretty sure what each line is doing. But hopefully it works.
 */
class PromiseRejectError extends Error {
  constructor(message, errData) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    this.errData = errData;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}
module.exports.PromiseRejectError = PromiseRejectError;

/**
 * Timeline style query parameters
 */
module.exports.getTimelineStyleQuery = function getTimelineStyleQuery(query, log, res) {
  return new Promise((resolve, reject) => {
    try {
    var queryCondition = {};

    //count
    var count = query.count;
    if(count && isNaN(parseInt(count))) {
      var msg = "count should be numeric but is " + count;
      errHandle.badRequest(res, msg);
      log.warn(msg);
      throw new PromiseReject();
    }
    queryCondition.count = count ? (count > 200 ? 200 : parseInt(count)) : 20;

    //maxId
    var maxId = query.maxId;
    if(maxId) {
      if(!queryCondition.range || !queryCondition.range._id) {
        queryCondition.range = {};
        queryCondition.range._id = {};
      }
      queryCondition.range._id['$lt'] = maxId;
    }

    //sinceId
    var sinceId = query.sinceId;
    if(sinceId) {
      if(!queryCondition.range || !queryCondition.range._id) {
        queryCondition.range = {};
        queryCondition.range._id = {};
      }
      queryCondition.range._id['$gt'] = sinceId;
    }

    log.info({queryCondition: queryCondition}, 'Fetching using query specification');
    resolve(queryCondition);
    } catch (err) {
        log.error({err}, 'Unknown error');
        throw new PromiseReject();
    }
  });
}

/**
 * Assert http request header given name and wanted field value
 */

module.exports.assertHeader = function(req, res, log, name, wanted) {
  var actual = req.get(name);
  if((wanted !== '*') && (wanted.split("|").indexOf(actual) === -1)) {
    res.status(400).send({'errCode':400, 'errMsg':"Bad request: " + 
          name + " should be '" + wanted + "' but got " + "'" + actual + "'"
    });
    log.info("Assert header %s, wanted: %s, actual: %s, failed", name, wanted, actual);
    return false;
  }
  log.info("Assert header %s, wanted: %s, actual: %s, passed", name, wanted, actual);
  return true;
};

/**
 * Error handling.
 * Given error type, respond object.
 */

function newErrorReturn(code, errMsg) {
  return { code, errMsg };
}

const errHandle = function errHandle() {};
errHandle.notFound = (res, err) => {
  res.status(404).send(newErrorReturn(404, sprintf('Not found: %j', err)));
};
errHandle.unknown = (res, err) => {
  res.status(500).send(newErrorReturn(500, sprintf('Unknown error: %j', err)));
};
errHandle.badRequest = (res, err) => {
  res.status(400).send(newErrorReturn(400, sprintf('Bad request: %j', err)));
};
// Error handler in catch block in promise chain.
errHandle.promiseCatchHanler = (res, log, err) => {
  if (err instanceof CastError) {
    log.warn({ err }, 'Cast error');
    errHandle.badRequest(res, err);
  } else if (!(err instanceof PromiseReject)) {
    log.error({ err }, 'Unknown error');
    errHandle.unknown(res, err);
  }
  return null;
};
module.exports.errHandle = errHandle;


/**
 * Logger system.
 *
 * @Deprecated Use 'utils/logger.js' instead.
 */

const bunyan = require('bunyan');
const uuid = require('node-uuid');

function photoSerializer(photo) {
  return {
    id: photo._id,
    imageUrl: photo.imageUrl,
    referenceId: photo.referenceId,
  };
}
function editorSerializer(editor) {
  return {
    id: editor._id,
    name: editor.name,
  };
}
function albumSerializer(album) {
  return {
    id: album._id,
    name: album.name,
    imageUrl: album.imageUrl,
  };
}
function userSerializer(user) {
  return {
    id: user._id,
    name: user.name,
  };
}
function reqSerializer(req) {
  return {
    method: req.method,
    url: req.originalUrl,
  };
}
function resSerializer(res) {
  return {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
  };
}
const log = bunyan.createLogger({
  name: 'copycat',
  streams: [
    {
      level: 'trace',
      stream: process.stdout,  // log TRACE and above to stdout
    },
    {
      level: 'debug',
      path: './log/copycat-debug.logfile', // log DEBUG and above to a file
    },
    {
      level: 'info',
      path: './log/copycat-info.logfile', // log INFO and above to a file
    },
    {
      level: 'error',
      path: './log/copycat-error.logfile', // log ERROR and above to a file
    },
  ],
  serializers: {
    err: bunyan.stdSerializers.err,
    req: reqSerializer,
    res: resSerializer,
    photo: photoSerializer,
    album: albumSerializer,
    editor: editorSerializer,
    user: userSerializer,
  },
});
module.exports.log = log;

module.exports.logReqIdMiddleware = function logReqIdMiddleware(req, res, next) {
  req.log = log.child({ reqId: uuid.v1() });
  next();
};
module.exports.logReq = function logReq(log, req) {
  log.info({ req }, 'New request');
};
module.exports.logRes = function logReq(log, res) {
  log.info({ res }, 'New response');
};



/**
 * Assert some field exist, otherwise return error badRequest
 */

module.exports.assertExist = function assertExist(obj, objName, res) {
  if (obj === null) {
    errHandle.badRequest(res, 'Missing ' + objName);
    return false;
  }
  return true;
};

/**
 * Assert each id exist for corresponding database
 */

const assertExistById = function assertExistById(model, idList, message) {
  return model.find({ $or: idList })
    .then((result) => {
      if (result === null || result.length !== idList.length) {
        throw new PromiseRejectError(idList, message);
      }
      return result;
    });
};

const assertUsersExistById = function assertUsersExistById(userIdList) {
  return assertExistById(models.User, userIdList,
  'Not all users exist in user id list.');
};

const assertUserExistById = function assertUserExistById(userId) {
  const userIdList = [];
  userIdList.push({ _id: userId });
  return assertUsersExistById(userIdList);
};

const assertPhotosExistById = function assertPhotosExistById(photoIdList) {
  return assertExistById(models.Photo, photoIdList,
  'Not all photos exist in user id list.');
};

const assertPhotoExistById = function assertPhotoExistById(photoId) {
  const photoIdList = [];
  photoIdList.push({ _id: photoId });
  return assertPhotosExistById(photoIdList);
};

module.exports.assertExistById = assertExistById;
module.exports.assertUsersExistById = assertUsersExistById;
module.exports.assertUserExistById = assertUserExistById;
module.exports.assertPhotosExistById = assertPhotosExistById;
module.exports.assertPhotoExistById = assertPhotoExistById;

