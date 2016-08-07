const express = require('express');
const router = new express.Router();
const config = require('../../../config.js');
const bodyParser = require('body-parser');
const util = require('util');
const Log = require('../../../utils/logger.js');
const Clarifai = require('clarifai');

/**
 * Error handler and self-defined error class.
 */
const errLib = require('../../../utils/error.js');
const errorHandler = errLib.errorHandler;
const BadRequestError = errLib.BadRequestError;
const UnknownError = errLib.UnknownError;

/**
 * Bluebird made promise easy
 */
const Promise = require('bluebird');
const request = Promise.promisify(require('request'));

/**
 * Return relative photo given a user selected photo.
 */
router.use(bodyParser.json({
  limit: '5mb',
}));
router.route('/')
.post((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  // data is required
  const data = req.body.data;
  if (!data) {
    const msg = 'Missing data part in request.';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  const getGoogleLabels = function getGoogleLabels(d) {
    log.info('Requesting label from Google Cloud Vision API');

    return request({
      url: util.format('https://vision.googleapis.com/v1/images:annotate?key=%s', config.cloudVisionApiKey),
      method: 'POST',
      json: {
        requests: [{
          image: { content: d },
          features: [{ type: 'LABEL_DETECTION', maxResults: 10 }],
        }],
      },
    }).then((responseBody) => {
      const body = responseBody.body;
      if (body) {
        const labels = [];
        const labelsAnnotations = body.responses[0].labelAnnotations;
        if (labelsAnnotations.length > 0) {
          for (let i = 0; i < labelsAnnotations.length; i++) {
            if (labelsAnnotations[i].score > 0.9) {
              labels.push(labelsAnnotations[i].description);
            }
          }
        }
        return labels;
      }
      throw new UnknownError('Unknown error when getting label from Google Cloud API');
    });
  };

  const getClarifaiLabels = function getClarifaiLabels(d) {
    log.info('Requesting label from Clarifai API');

    Clarifai.initialize({
      clientId: config.clarifaiClientId,
      clientSecret: config.clarifaiClientSecret,
    });

    return Clarifai.getTagsByImageBytes(d)
    .then((result) => {
      if (result.status_code === 'OK') {
        log.info({ result }, 'Get result from Clarifai');
        const labels = [];
        const tags = result.results[0].result.tag.classes;
        const probs = result.results[0].result.tag.probs;

        // Only puts if score higher than 0.9
        for (let i = 0; i < tags.length; i++) {
          if (probs[i] > 0.9) {
            labels.push(tags[i]);
          }
        }
        return labels;
      }
      throw new UnknownError('Unknown error when getting label from Clarifai Vision API');
    });
  };

  const getRelatedPhoto = function getRelatedPhoto(googleLabels, clarifaiLabels) {
    log.info('Request photos from popular websites.');
    const allLabels = [].concat(googleLabels).concat(clarifaiLabels);
    if (allLabels.length < 3) {
      const msg = 'Got too less labels. Your picture is too unique.';
      throw new UnknownError(msg);
    }

    const labels = allLabels.splice(0, 3);
    const labelString = labels.join(',').replace(/\s+/g, '%20');

    return Promise.promisify(request)({
      url: util.format('http://%s/api/v0/search?labels=%s', config.loadBalancer, labelString),
      method: 'GET',
    })
    .then((responseBody) => {
      const body = responseBody.body;

      const result = {};
      result.labels = allLabels;
      result.photos = JSON.parse(body);
      return result;
    });
  };

  // respond
  function respond(d) {
    res.status(200).send(d);
    log.logRes();
  }

  Promise.join(
    getGoogleLabels(data),
    getClarifaiLabels(data),
    getRelatedPhoto
  )
  .then(respond)
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });

  return null;
});

module.exports = router;
