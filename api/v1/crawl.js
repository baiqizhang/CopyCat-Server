const express = require('express');
const router = new express.Router();
const bodyParser = require('body-parser');
const Log = require('../../utils/logger.js');
const request = require('request').defaults({ encoding: null });
const cheerio = require('cheerio');
const util = require('util');
const config = require('../../config');
const url = require('url');

/**
 * Error handler and self-defined error class.
 */
const errLib = require('../../utils/error.js');
const errorHandler = errLib.errorHandler;
const BadRequestError = errLib.BadRequestError;

/**
 * Bluebird made promise easy
 */
const Promise = require('bluebird');

const getAsync = Promise.promisify(request.get);
const postAsync = Promise.promisify(request.post);

/**
 * compress image
 */
const gm = require('gm').subClass({
  imageMagick: true,
});

/**
 * post http://hostname:port/crawl
 * {
 *   url: 'url to crawl',
 *   minHeight(optional): 300,
 *   minWidth(optional): 400,
 * }
 */
router.use(bodyParser.json());
router.route('/')
.post((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  const _url = req.body.url;
  if (!_url) {
    const msg = 'Missing url in post json.';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  // Get all image urls from given url.
  // For now, we consider these situations:
  // 1. <img src='...' />
  // 2. <div background-image: url('...')/>
  getAsync(util.format('http://splash:%d/render.html?url=%s&timeout=%d&wait=%d',
    config.splashCrawlerHttpPort, _url, config.splashCrawlerTimeout, config.splashCrawlerWait))
  .then((responseBody) => {
    const body = responseBody.body;
    const $ = cheerio.load(body);
    const imageUrls = [];

    // <img src='...' />
    // Suitable: Unsplash.com, 500px.com
    const images1 = $('img');
    for (let i = 0; i < images1.length; ++i) {
      imageUrls.push($(images1[i]).attr('src'));
    }

    // <div background-image: url('...')/>
    // Suitable: Flickr.com
    const images2 = $('div').filter((i, div) =>
      $(div).css('background-image')
    );
    // Only handle situation that imageUrl is of format url('...')
    for (let i = 0; i < images2.length; ++i) {
      const re = /url\((.*)\)/;
      const styleString = $(images2[i]).css('background-image');
      const results = re.exec(styleString);
      const imageUrl = results[1];
      const urlObject = url.parse(imageUrl);

      // Some url begins with //
      if (!urlObject.protocol) {
        urlObject.protocol = 'http:'; // http is default protocol.
      }
      imageUrls.push(url.format(urlObject));
    }

    log.info({ imageUrls }, 'img Get crawl image urls.');
    return imageUrls;
  })
  // For each image, we download it, and get
  // size of the image.
  .map((imageUrl) =>
      getAsync(imageUrl)
      .then((responseBody) => {
        const body = responseBody.body;
        return new Promise((resolve) => {
          gm(body, 'img')
          .size((err, size) => {
            // Ignore error when downloading image, some image urls maybe broken.
            if (err) {
              log.warn({ err }, 'Ignore error when downloading image.');
              resolve({ imageUrl: null, size: { width: 0, height: 0 }, body: null });
            } else {
              log.info({ imageUrl, size }, 'Got size of new photo.');
              resolve({ imageUrl, size, body });
            }
          });
        });
      })
      // Ignore error when downloading image, some image urls maybe broken.
      .catch((err) => {
        log.warn({ err }, 'Ignore error when downloading image.');
        return { imageUrl: null, size: { width: 0, height: 0 }, body: null };
      })
  , { concurrency: 3 })
  // We only care about images that are large enough.
  // Small images are very likely to be icon, navigation image etc.
  .filter((image) => {
    const size = image.size;
    const minWidth = req.body.mimWidth || config.crawlerImageMinimumWidth;
    const minHeight = req.body.minHeight || config.crawlerImageMinHeight;
    return size.width >= minWidth && size.height >= minHeight;
  })
  // Upload these images to S3.
  .map((image) => {
    const size = image.size;
    const imageUrl = image.imageUrl;
    log.info({ imageUrl, size }, 'Crawl new image.');

    return postAsync({
      url: util.format('http://localhost:%d/api/v1/photos', config.httpPort),
      json: {
        data: image.body,
      },
    })
    .then((responseBody) => responseBody.body.imageUrl);
  })
  // Return results.
  .then((imageUrls) => {
    log.info(imageUrls, 'Crawl new images.');
    res.status(201).send({ images: imageUrls });
  })
  .catch((err) => errorHandler.handle(err, log, res));

  return null;
});

module.exports = router;
