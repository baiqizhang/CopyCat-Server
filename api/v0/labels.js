const express = require('express');
const router = new express.Router();
const PythonShell = require('python-shell');

const helper = require('./helper.js');
const errHandle = helper.errHandle;

// labels
router.route('/')
.get((req, res) => {
  const imageUrl = req.query.url;

  const options = {
    // script path is from entry of node.js program, which is dir of server.js
    scriptPath: './python_modules/',
    args: ['AIzaSyA8WAYHLpgXjB2ajsgscSiFlOl05-lTvEA', imageUrl],
  };

  PythonShell.run('google_vision_label_detection.py', options, (err, results) => {
    if (err) return errHandle.unknown(res, err);
    res.send(JSON.parse(results));
    return null;
  });
});

module.exports = router;
