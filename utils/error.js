const CastError = require('mongoose').CastError;
/**
 * A customized Error that is used in Promise chain.
 * So that we could throw this Error to break out of Promise chain.
 */
const ExtendableError = require('es6-error');

/**
 * Error handling.
 * Given error type, respond object.
 */
function newErrorReturn(statusCode, msg) {
  return { statusCode, msg };
}

const notFound = function notFound(res, errMsg) {
  res.status(404).send(newErrorReturn(404, errMsg));
};
const unknown = function unknown(res, errMsg) {
  res.status(500).send(newErrorReturn(500, errMsg));
};
const badRequest = function badRequest(res, errMsg) {
  res.status(400).send(newErrorReturn(400, errMsg));
};

/**
 * Some self-defined extended error class.
 *
 * Usage:
 * SomePromise()
 * .then(() => {
 *   // Some thing wrong happens
 *   throw new MyError(util.format('This is wrong %j.', errData), errData);
 * })
 * .catch((err) => {
 *   if (err instanceof SomeErrorYouWantToExplicitlyHandle) {
 *     ...
 *   } else {
 *     errorHandler.handle(err);
 *   }
 * });
 */

/**
 * Base class for other error happened in Promise.
 */
class PromiseError extends ExtendableError {
  handle() {
    throw new Error('Method handle must be override.');
  }
}

/**
 * Used when query is in bad format.
 *
 * Usual case:
 * if (!req.query.somePara) {
 *   return errHandler.handle(new BadRequestError(...));
 * }
 */
class BadRequestError extends PromiseError {
  handle(log, res) {
    log.warn({ message: this.message }, 'BadRequestError');
    badRequest(res, this.message);
  }
}
module.exports.BadRequestError = BadRequestError;

/**
 * Used when document is not found.
 *
 * Usual case:
 * model.Model.find({_id:ObjectId(some id)})
 * .then((document) => {
 *   if (!document || document.length === 0) {
 *     throw new DocumentNotFoundError(...);
 *   }
 * })
 * .catch(...);
 */
class DocumentNotFoundError extends PromiseError {
  handle(log, res) {
    log.warn({ message: this.message }, 'DocumentNotFoundError');
    notFound(res, this.message);
  }
}
module.exports.DocumentNotFoundError = DocumentNotFoundError;

class UnknownError extends PromiseError {
  handle(log, res) {
    log.warn({ message: this.message }, 'Unknown');
    unknown(res, this.message);
  }
}
module.exports.UnknownError = UnknownError;

/**
 * Error handler for log and respond to user
 * based on error happened in Promise.
 */
class ErrorHandler {
  handle(err, log, res) {
    if (!log || !res) {
      log.debug('errorHandler.handle() need log and res as second and third parameters');
    } else {
      if (err instanceof PromiseError) {
        err.handle(log, res);
      } else if (err instanceof CastError) {
        log.warn({ err }, 'CastError');
        badRequest(res, err.message);
      } else {
        log.error({ err }, (err.prototype && err.property.name) || 'UnexpectedError');
        unknown(res, err);
      }
    }
  }
}

module.exports.errorHandler = new ErrorHandler();
