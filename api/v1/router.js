const express = require('express');
const router = new express.Router();

//const photos = require('./photos.js');
//const timeline = require('./timeline.js');
//const heartbeat = require('./heartbeat.js');
//const feedback = require('./feedback.js');
//const instagram = require('./socialmedia/instagram.js');
//const reports = require('./reports.js');
//const users = require('./users.js');
const smartExperiment = require('./experiment/smart.js');
const searchExperiment = require('./experiment/search.js');
const logExperiment = require('./experiment/logger.js');
//router.use('/photos', photos);
//router.use('/timeline', timeline);
//router.use('/heartbeat', heartbeat);
//router.use('/feedback', feedback);
//router.use('/instagram', instagram);
//router.use('/reports', reports);
//router.use('/users', users);
router.use('/smart', smartExperiment);
router.use('/search', searchExperiment);
router.use('/log', logExperiment);

module.exports = router;
