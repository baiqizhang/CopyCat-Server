const express = require('express');
const router = new express.Router();
const config = require('../../../config.js');

/**
 * Promise lib
 */
const Promise = require('bluebird');
const request = Promise.promisifyAll(require('request'));

/**
 * helper functions and objects
 */
const helper = require('../helper.js');
const errHandle = helper.errHandle;
const login = require('../auth/login.js');
const PromiseReject = helper.PromiseReject;

/**
 * log objects and functions
 */
const logReq = helper.logReq;
const logReqIdMiddleware = helper.logReqIdMiddleware;

/**
 * Add reqId to each request
 */
router.use(logReqIdMiddleware);

/**
 * Login instagram.
 */
router.route('/login')
.get((req, res) => {
  logReq(req.log, req);

  if (!req.query.code) {
    const msg = 'Missing code in request';
    req.log.warn(msg);
    return errHandle.badRequest(res, msg);
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
    req.log.info({ response, body }, 'Get response from instagram server');

    if (!body.access_token) {
      res.send(body);
      throw new PromiseReject();
    }

    return body;
  })
  // Get copycat user
  .then(Promise.promisify(login.instagram))
  // Return
  .then((user) => {
    req.log.info({ user }, 'Get instagram user');
    res.send(user);
  })
  // Error handling
  .catch((err) => {
    if (!(err instanceof PromiseReject)) {
      req.log.error({ err }, 'Unknown error');
      errHandle.unknown(res, err);
    }
  });

  return null;
});

module.exports = router;
