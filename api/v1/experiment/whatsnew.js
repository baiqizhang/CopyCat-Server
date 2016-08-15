/**
 * Created by cgwang on 8/14/16.
 */

const express = require('express');
const router = new express.Router();
const path = require("path");
const fs = require("fs");
const changeLogFile = path.join(path.dirname(require.main.filename), "changeLog", "copycat-change.log");
const changeHtml = path.join(path.dirname(require.main.filename), "static", "html", "change.html");
var bodyParser = require("body-parser");
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

var changeObj = {};

fs.readFile(changeLogFile, (err, data) => {
    if (err) {
        throw err;
    }
    changeObj = JSON.parse(data);
});


router.route("/").get((req, res) => {
    let version = +req.query.version;
    let lang = req.query.lang.indexOf("en") != -1 ? "cn" : "eng";
    let result = {
        curVersion: changeObj.curVersion,
        html: '<body style="background-color: #f2eeed;"><ol>'
    };
    if (version < changeObj.curVersion) {
        for (var i = version + 1; i <= changeObj.curVersion; i++) {
            result.html += "<li style='font-size: 14px;'>" + changeObj.histories[i + ""][lang] + "</li>";
        }
    }
    result.html += "</ol></body>"
    res.json(result);
});

router.route("/upload").get((req, res) => {
    fs.readFile(changeHtml, function(err, data){
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(data);
        res.end();
    });
});

router.route("/upload").post((req, res) => {

    changeObj.curVersion += 1;
    changeObj.histories[changeObj.curVersion] = {
        "cn": req.body["new_cn"],
        "eng": req.body["new_eng"]
    };

    fs.writeFile(changeLogFile, JSON.stringify(changeObj), function(err) {
        if(err) {
            return console.log(err);
        }
        res.end("Uploaded");
    });
});

router.route("/reset").get((req, res) => {

    changeObj = {"curVersion":0,"histories":{}};
    fs.writeFile(changeLogFile, JSON.stringify(changeObj), function(err) {
        if(err) {
            return console.log(err);
        }
        res.end("reset");
    });
});

module.exports = router;
