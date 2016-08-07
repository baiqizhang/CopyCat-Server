const express = require('express');
const router = new express.Router();

const promos = require('./promos.js');
const albums = require('./albums.js');
const photos = require('./photos.js');
const labels = require('./labels.js');
const timeline = require('./timeline.js');
const heartbeat = require('./heartbeat.js');
const feedback = require('./feedback.js');
const instagram = require('./socialmedia/instagram.js');
const reports = require('./reports.js');
const users = require('./users.js');
const smartExperiment = require('./experiment/smart.js');
const searchExperiment = require('./experiment/search.js');

router.use('/promos', promos);
router.use('/albums', albums);
router.use('/photos', photos);
router.use('/labels', labels);
router.use('/timeline', timeline);
router.use('/heartbeat', heartbeat);
router.use('/feedback', feedback);
router.use('/instagram', instagram);
router.use('/reports', reports);
router.use('/users', users);
router.use('/smart', smartExperiment);
router.use('/search', searchExperiment);

module.exports = router;
