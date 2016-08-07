const express = require('express');
const router = new express.Router();
const config = require('../../../config.js');
const Log = require('../../../utils/logger.js');
const login = require('../../../utils/login.js');

const errLib = require('../../../utils/error.js');
const errorHandler = errLib.errorHandler;
const BadRequestError = errLib.BadRequestError;
const UnknownError = errLib.UnknownError;

/**
 * Promise lib
 */
const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));

/**
 * Login instagram.
 */
router.route('/login')
.get((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  if (!req.query.code) {
    const msg = 'Missing code in request';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  // Get ins user from instagram server
  request.postAsync(
    'https://api.instagram.com/oauth/access_token',
    { form: {
      client_id: config.instagram.clientId,
      client_secret: config.instagram.clientSecret,
      grant_type: config.instagram.grantType,
      redirect_uri: config.instagram.redirectURL,
      code: req.query.code,
    },
    }
  )
  .then((resBody) => {
    const response = resBody.response;
    const body = JSON.parse(resBody.body);
    log.info({ response, body }, 'Get response from instagram server');

    if (!body.access_token) {
      const msg = 'Get unknown error when loging into instagram';
      throw new UnknownError(msg);
    }

    return body;
  })
  // Get copycat user
  .then(Promise.promisify(login.instagram))
  // Return
  .then((user) => {
    log.info({ user }, 'Get instagram user');
    res.send(user);
  })
  // Error handling
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });

  return null;
});

module.exports = router;
