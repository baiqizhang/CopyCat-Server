const express = require('express');
const router = new express.Router();
const config = require('../../../config.js');
const bodyParser = require('body-parser');
const request = require('request');
const util = require('util');
const helper = require('../helper.js');

/**
 * Bluebird made promise easy
 */
const Promise = require('bluebird');

/**
 * helper functions and objects
 */
const errHandle = helper.errHandle;
const PromiseReject = errHandle.PromiseReject;

/**
 * compress image
 */
// const gm = require('gm').subClass({
//   imageMagick: true,
// });

/**
 * log objects and functions
 */
const logReq = helper.logReq;
const logRes = helper.logRes;
const logReqIdMiddleware = helper.logReqIdMiddleware;

/**
 * Add reqId to each request
 */
router.use(logReqIdMiddleware);

/**
 * Return relative photo given a user selected photo.
 */
router.use(bodyParser.json({
  limit: '5mb',
}));
router.route('/')
.post((req, res) => {
  logReq(req.log, req);

  // data is required
  const data = req.body.data;
  if (!data) {
    const msg = 'Missing data part in request.';
    req.log.error(msg);
    return errHandle.badRequest(res, msg);
  }
  // data = new Buffer(data, 'base64');

  // get photo size info
  // function getSize() {
  //   return new Promise((resolve) => {
  //     gm(data, 'img')
  //     .size((err, size) => {
  //       if (err) throw err;
  //       req.log.info(size, 'Got size of new photo.');
  //       resolve(size);
  //     });
  //   });
  // }

  function compressPhoto() {
    /*
    let width = size.width;
    let height = size.height;
    if (width > config.maxWidth || height > config.maxHeight) {
      return new Promise((resolve) => {
        const widthScale = width / 800;
        const heightScale = height / 800;
        const scale = Math.max(widthScale, heightScale);
        width = Math.round(width / scale);
        height = Math.round(height / scale);

        gm(data, 'test.jpg')
        .setFormat('jpg')
        .resize(width, height)
        .toBuffer((err, buffer) => {
          if (err) throw err;
          req.log.info({ width, height }, 'Compressed new photo.');
          resolve(buffer.toString('utf-8'));
        });
      });
    }
    */
    return new Promise((resolve) => {
      resolve(data);
    });
  }

  const getGoogleLabels = function getGoogleLabels(d) {
    req.log.info('Requesting label from Google Cloud Vision API');

    return new Promise((resolve) => request({
      url: util.format('https://vision.googleapis.com/v1/images:annotate?key=%s', config.cloudVisionApiKey),
      method: 'POST',
      json: {
        requests: [{
          image: { content: d },
          features: [{ type: 'LABEL_DETECTION', maxResults: 10 }],
        }],
      },
    }, (err, response, body) => {
      const labels = [];
      const labelsAnnotations = body.responses[0].labelAnnotations;
      if (labelsAnnotations.length === 0) {
        const msg = 'No annotation found';
        req.log.info(msg);
        res.send({});
        throw new PromiseReject();
      }
      // Definitely put first description in
      labels.push(labelsAnnotations[0].description);
      // For following description, only puts if score higher than 0.9
      for (let i = 1; i < labelsAnnotations.length; i++) {
        if (labelsAnnotations[i].score > 0.9) {
          labels.push(labelsAnnotations[i].description);
        }
      }
      resolve(labels);
    }));
  };

  const getClarifaiLabels = function getClarifaiLabels(d) {
    req.log.info('Requesting label from Clarifai API');

    return new Promise((resolve) => request({
      url: util.format('https://api.clarifai.com/v1/tag/?access_token=CodNXTFfVKHtK1QIHizgAXn5bLFyLv'),
      method: 'POST',
      json: {
        encoded_data: d,
      },
    }, (err, response, body) => {
      if (body !== null && body.status_code === 'OK') {
        const labels = [];
        const tags = body.results[0].result.tag.classes;
        const probs = body.results[0].result.tag.probs;

        if (tags.length === 0 || probs.length === 0) {
          const msg = 'No annotation found';
          req.log.info(msg);
          res.send({});
          throw new PromiseReject();
        }

        // Only puts if score higher than 0.9
        for (let i = 0; i < tags.length; i++) {
          if (probs[i] > 0.9) {
            labels.push(tags[i]);
          }
        }
        resolve(labels);
      }
    }));
  };
  const getRelatedPhoto = function getRelatedPhoto(googleLabels, clarifaiLabels) {
    req.log.info('Request photos from popular websites.');
    const allLabels = [].concat(googleLabels).concat(clarifaiLabels);
    const labels = allLabels.splice(0, 3);

    const labelString = labels.join(',').replace(/\s+/g, '%20');
    return new Promise((resolve) => request({
      url: util.format('http://%s/api/v0/search?labels=%s', config.loadBalancer, labelString),
      method: 'GET',
    }, (err, response, body) => {
      resolve({ labels: allLabels, photos: JSON.parse(body) });
    }));
  };

  // respond
  function respond(d) {
    res.status(200);
    res.send(d);
    logRes(req.log, res);
  }

  // getSize()
  const compressedPhoto = compressPhoto();
  Promise.join(
    compressedPhoto.then(getGoogleLabels),
    compressedPhoto.then(getClarifaiLabels),
    getRelatedPhoto
  )
  .then(respond)
  .catch((err) => errHandle.promiseCatchHanler(res, req.log, err));

  return null;
});

module.exports = router;
