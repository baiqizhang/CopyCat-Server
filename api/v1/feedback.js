const nodemailer = require('nodemailer');
const express = require('express');
const router = new express.Router();
const bodyParser = require('body-parser');
const Log = require('../../utils/logger.js');
const util = require('util');

const errLib = require('../../utils/error.js');
const BadRequestError = errLib.BadRequestError;
const errorHandler = errLib.errorHandler;

/**
 * Create reusable transporter object using the default SMTP transport
 * This actually defines SENDER!!
 */
const smtpConfig = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: 'copycatsvteam@gmail.com',
    pass: 'copycatteam',
  },
};
const transporter = nodemailer.createTransport(smtpConfig);

/**
 * Post a feedback
 */
router.use(bodyParser.json({ limit: '5mb' })); // Feed no more than 5mb
router.route('/')
.post((req, res) => {
  const log = new Log(req, res);
  log.logReq();

  if (!req.body.subject ||
      !req.body.contact ||
      !req.body.text) {
    const msg = 'Missing field, need contact, subject, text. '
      + 'Example: {contact: "Jinping Xi" <xidada@gmail.com>, '
      + 'subject: "Yo yo check now", text: "Jian bing guo zi lai yi tao"';
    return errorHandler.handle(new BadRequestError(msg), log, res);
  }

  // Modify text and html to include contact.
  const text = util.format('%s\n\nContact:\n%s\n', req.body.text, req.body.contact);

  // Setup e-mail data with unicode symbols.
  const mailOptions = {
    from: req.body.contact, // sender address, this field seems USELESS in our condition
    to: 'copycatsvteam@gmail.com', // list of receivers
    subject: req.body.subject, // Subject line
    text, // plaintext body
    //html: req.body.text // html body
  };

  // Send mail with defined transport object.
  transporter.sendMail(mailOptions)
  .then((info) => {
    log.info({ info }, 'Get new feedback');
    res.send(info);
  })
  .catch((err) => {
    errorHandler.handle(err, log, res);
  });
  return null;
});

module.exports = router;

