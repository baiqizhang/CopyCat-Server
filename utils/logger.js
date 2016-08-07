/**
 * A logger plugin.
 *
 * Each time a new request comes, we should create a new logger (actually a new child logger) for
 * it.
 * Usage:
 * function(req, res, next) {
 *   const log = logger.newLog();
 *
 *   ...
 *
 *   log.logReq(req);
 *   log.logRes(res);
 *   log.info({ photo }, 'New photo')
 *   log.warn({ photo }, 'New photo')
 *   log.error({ photo }, 'New photo')
 * }
 */

const bunyan = require('bunyan');
const uuid = require('node-uuid');

/**
 * Bunch of serializers, these are used to generate log output when passing
 * a frequently used data model.
 */
function photoSerializer(photo) {
  return {
    id: photo._id,
    imageUrl: photo.imageUrl,
    referenceId: photo.referenceId,
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

const loggerGenerator = bunyan.createLogger({
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
      level: 'warn',
      path: './log/copycat-warn.logfile', // log WARN and above to a file
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
    user: userSerializer,
  },
});

class Log {
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.log = loggerGenerator.child({ reqId: uuid.v1() });
  }

  logReq() {
    this.log.info({ req: this.req }, 'New request');
  }

  logRes() {
    this.log.info({ res: this.res }, 'New response');
  }

  error(...args) {
    this.log.error(...args);
  }

  warn(...args) {
    this.log.warn(...args);
  }

  info(...args) {
    this.log.info(...args);
  }

  debug(...args) {
    this.log.debug(...args);
  }

  trace(...args) {
    this.log.trace(...args);
  }
}

module.exports = Log;
