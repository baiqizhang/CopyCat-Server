const express = require('express');
const router = new express.Router();
const request = require('request');
const util = require('util');
const helper = require('../helper.js');
const config = require('../../../config.js');

/**
 * helper functions and objects
 */
const errHandle = helper.errHandle;

/**
 * Bluebird made promise easy
 */
const Promise = require('bluebird');

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
 * Return relative photo given some labels.
 */
router.route('/')
.get((req, res) => {
  logReq(req.log, req);

  // Get all labels.
  if (!req.query.labels) {
    const msg = 'Missing labels.';
    req.log.warn(msg);
    return errHandle.badRequest(res, msg);
  }
  const labels = req.query.labels.split(',');

  /*
   * Search response JSON Format:
   * {
   *   urls: {
   *     regular: 'photo_url',
   *   },
   *   user: {
   *     name: 'name',
   *     profile_image: 'profile_url',
   *   },
   *   created_at: 'yyyy-MM-ddTHH:mm:ss-xx:xx',
   * }
   */

  const getUnsplashPhotos = function getUnsplashPhotos(_labels) {
    req.log.info('Request photos from unsplash.com');
    const labelString = _labels.join(',').replace(/\s+/g, '%20');
    return new Promise((resolve) => request({
      url: util.format('https://api.unsplash.com/photos/search?query=%s&client_id=6aeca0a320939652cbb91719382190478eee706cdbd7cfa8774138a00dd81fab', labelString),
      method: 'GET',
    }, (err, response, body) => {
      const d = JSON.parse(body);
      const photos = [];
      for (let i = 0; i < d.length; i++) {
        photos.push({
          urls: {
            regular: d[i].urls.regular,
          },
          user: {
            name: d[i].user.name + ' (Unsplash)',
            profile_image: d[i].user.profile_image,
          },
          created_at: d[i].created_at,
        });
      }
      resolve(photos);
    }));
  };

  const getFlickrPhotos = function getFlickrPhotos(_labels) {
    req.log.info('Request photos from flickr.com');
    const labelString = _labels.join(',').replace(/\s+/g, '%20');
    return new Promise((resolve) => request({
      url: util.format('https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=%s&tags=%s&tag_mode=all&sort=relevance&content_type=1&format=json&nojsoncallback=1', config.flickrApiKey, labelString),
      method: 'GET',
    }, (err, response, body) => {
      const d = JSON.parse(body);
      const photos = [];
      const rawPhotoData = d.photos.photo;
      for (let i = 0; i < rawPhotoData.length; ++i) {
        const rawPhotoElement = rawPhotoData[i];
        const id = rawPhotoElement.id;
        const farm = rawPhotoElement.farm;
        const secret = rawPhotoElement.secret;
        const server = rawPhotoElement.server;
        photos.push({
          urls: {
            regular: util.format('https://farm%d.staticflickr.com/%s/%s_%s_c.jpg', farm, server, id, secret),
          },
          user: {
            name: 'Flickr',
            profile_image: {
              small: config.anonymousProfilePictureUrl,
            },
          },
          created_at: '2016-02-10T10:49:02-04:00',
        });
      }
      resolve(photos);
    }));
  };

  const get500PXPhotos = function get500PXPhotos(_labels) {
    req.log.info('Request photos from flickr.com');
    const labelString = _labels.join('%20').replace(/\s+/g, '%20');
    return new Promise((resolve) => request({
      url: util.format('https://api.500px.com/v1/photos/search?term=%s&tags&image_size=600,440&rpp=100&sort=_score&consumer_key=%s', labelString, config.consumerKey500px),
      method: 'GET',
    }, (err, response, body) => {
      const d = JSON.parse(body);
      const photos = [];
      const rawPhotoData = d.photos;
      for (let i = 0; i < rawPhotoData.length; ++i) {
        const rawPhotoElement = rawPhotoData[i];
        photos.push({
          urls: {
            regular: rawPhotoElement.images[0].url,
          },
          user: {
            name: util.format('%s %s (500px)', rawPhotoElement.user.firstname,
              rawPhotoElement.user.lastname),
            profile_image: rawPhotoElement.user.userpic_url,
          },
          created_at: rawPhotoElement.created_at,
        });
      }
      resolve(photos);
    }));
  };

  Promise.join(
    getUnsplashPhotos(labels),
    getFlickrPhotos(labels),
    get500PXPhotos(labels),
    (unsplashPhotos, flickrPhotos, px500Photos) => {
      let rawPhotos = [];
      rawPhotos = rawPhotos.concat(unsplashPhotos);
      rawPhotos = rawPhotos.concat(px500Photos);
      rawPhotos = rawPhotos.concat(flickrPhotos);

      const photos = [];
      for (let i = 0; i < Math.min(config.maximumSearchPhotoNumber, rawPhotos.length); ++i) {
        photos.push(rawPhotos[i]);
      }

      return photos;
    })
  .then((photos) => {
    res.status(200).send(photos);
    logRes(req.log, res);
  })
  .catch((err) => errHandle.promiseCatchHanler(res, req.log, err));

  return null;
});

module.exports = router;
