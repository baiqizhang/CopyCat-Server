const express = require('express');
const router = new express.Router();
const request = require('request');
const fs = require("fs");
const path = require("path");
const util = require('util');
const config = require('../../../config.js');
const Log = require('../../../utils/logger.js');
const appDir = path.dirname(require.main.filename);
/**
 * Error handler and self-defined error class.
 */
const errLib = require('../../../utils/error.js');
const errorHandler = errLib.errorHandler;
const BadRequestError = errLib.BadRequestError;
const pubDir = path.join(appDir, "public", "popularTags");
/**
 * Bluebird made promise easy
 */
const Promise = require('bluebird');
const prefix = "http://ec2-52-42-208-246.us-west-2.compute.amazonaws.com:3001";
/**
 * Given some search labels, separated by commas, return
 * relative photo from popular image website.
 *
 * This function first use the labels to get photos from
 * Unsplash.com, 500px.com and Flickr.com. Then combine
 * these results togher and return back to user.
 *
 * The response JSON format is:
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

var popularTag = null;

const updateList = function (dir) {
  fs.readdir(dir, (err, files) => {
    popularTag = new Set();
    for (let i = 0; i < files.length; i++) {
      popularTag.add(files[i]);
    }
  });
};

fs.watch(pubDir, {
  recursive: true
}, () => {
  updateList(pubDir);
});

updateList(pubDir);

router.route('/')
.get((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  // Get all labels.
  if (!req.query.labels) {
    const msg = 'Missing labels.';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }
  const labels = req.query.labels.split(',');

  const getUnsplashPhotos = function getUnsplashPhotos(_labels) {
    log.info('Request photos from unsplash.com');
    const labelString = _labels.join(',').replace(/\s+/g, '%20');
    return new Promise((resolve) => request({
      url: util.format('https://api.unsplash.com/photos/search?query=%s&client_id=%s', labelString, config.unsplashClientId),
      method: 'GET'
    }, (err, response, body) => {
      const d = JSON.parse(body);
      const photos = [];
      for (let i = 0; i < d.length; i++) {
        photos.push({
          urls: {
            regular: d[i].urls.regular,
            small: d[i].urls.small
          },
          created_at: d[i].created_at
        });
      }
      resolve(photos);
    }));
  };
  const getLocalPhotos = function getCachedPhotos(_labels) {
    log.info('Request photos from local file sys');
    const labelString = _labels;
    var promises = [];
    for (let label of _labels) {
      if (popularTag.has(label)) {
        promises.push(new Promise((resolve) => fs.readdir(path.join(pubDir, label), (err, files) => {
          const photos = [];
          for (let i = 0; i < files.length; i++) {
            photos.push({
              urls: {
                regular: prefix + "/popularTags/" + label + "/" + files[i],
                small: prefix + "/popularTags/" + label + "/" + files[i]
              },
              created_at: Date.now()
            });
          }
          resolve(photos);
        })));
      }
    }
    return promises;
  };
 /* const getFlickrPhotos = function getFlickrPhotos(_labels) {
    log.info('Request photos from flickr.com');
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
          // Flickr need to search each photo to get creation time,
          // so we just put a hacked time here.
          created_at: '2016-02-10T10:49:02-04:00',
        });
      }
      resolve(photos);
    }));
  };

  const get500PXPhotos = function get500PXPhotos(_labels) {
    log.info('Request photos from flickr.com');
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
**/
  var localPromises = getLocalPhotos(labels);
  localPromises.push(getUnsplashPhotos(labels));
  Promise.all(
    localPromises
    //getFlickrPhotos(labels),
    //get500PXPhotos(labels),
  ).then((data) => {

    let rawPhotos = [].concat.apply([], data);
    const photos = [];
    for (let i = 0; i < rawPhotos.length; ++i) {
      photos.push(rawPhotos[i]);
    }
    res.status(200).send(photos);
    log.logRes();
  })
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });

  return null;
});

router.route("/updateList").get((req, res) => {
  res.send({
    tags : Array.from(popularTag)
  });
});

module.exports = router;
