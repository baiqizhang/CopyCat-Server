/**
 * Created by cgwang on 8/14/16.
 */
const express = require('express');
const router = new express.Router();
const path = require("path");
const fs = require("fs");

const logfile = path.join(path.dirname(require.main.filename), "log", "copycat-search.log");
try {
    var summary = JSON.parse(fs.readFileSync(logfile, 'utf8'));
} catch (e) {
    summary = {};
}
router.route('/')
    .get((req, res) => {
        const word = req.query.keyword.toLowerCase();
        if (summary.hasOwnProperty(word)) {
            summary[word] += 1;
        } else {
            summary[word] = 1;
        }
        res.end();
        fs.writeFile(logfile, JSON.stringify(summary), function(err) {
            if(err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });
    });
module.exports = router;
