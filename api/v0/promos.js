const express = require("express");
const router = express.Router();
const models = require("../../database/models.js");
const bodyParser = require('body-parser');

/**
 * Helper functions
 */
const helper = require('./helper.js');
const errHandle = helper.errHandle;
const PromiseReject = helper.PromiseReject;

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
 * Promos/Hot
 * Hot is timeline of albums, indicating the most popular albums 
 * in recent period of time.
 */
router.route('/hot')
.get(function(req, res, next) {
  logReq(req.log, req);

  //getQueryCondition
  helper.getTimelineStyleQuery({
      count:req.query.count, 
      maxId:req.query.maxId, 
      sinceId:req.query.sinceId
    },
    req.log,
    res
  )

  //get albums
  .then(function getAlbums(queryCondition) {
    return models.Album
    .find(queryCondition.range)
    .sort({_id:-1})
    .limit(queryCondition.count)
    .populate({
        path: 'photoIdList',
        populate: {
            path: 'ownerId',
            model: 'User',
        },
    })
  })
  
  //respond
  .then(function respond(albums) {
    res.send(albums);
    logRes(req.log, res);
  })

  //error handling
  .catch (function(err) {
    if(!(err instanceof PromiseReject)) {
      req.log.error({err:err}, "Unknown error");
      errHandle.unknown(res, err);
    }
  });
});

/**
 * Promos/Editor
 * Editor Choice is a collection of albums, selected by 
 * editors with similar topic, relation etc.
 */
router.route('/editor')
//get timeline of editors
.get(function(req, res, next) {
  logReq(req.log, req);

  //TODO Now we just return a random editor, this may
  //need to fix. For now, we are not clear how this
  //feature will work, so this is okay.
  models.Editor
  .findOne()
  .populate({
      path: 'albumIdList',
      populate: {
          path: 'ownerId',
          model: 'User',
      },
  })

  /*
   * This is potentially better way to do this
   *
  //get query
  helper.getTimelineStyleQuery({
      count:req.query.count, 
      maxId:req.query.maxId, 
      sinceId:req.query.sinceId
    },
    req.log,
    res
  )

  //get editor
  .then(function getEditors(queryCondition) {
    return models.Editor
    .find(queryCondition.range)
    .sort({_id:-1})
    .limit(queryCondition.count)
    .populate('albumIdList');
  })
  */

  //respond
  .then(function respond(editors) {
    res.send(editors);
    logRes(req.log, res);
  })
  
  //error handling
  .catch (function(err) {
    if(!(err instanceof PromiseReject)) {
      req.log.error({err:err}, "Unknown error");
      errHandle.unknown(res, err);
    }
  });
})
.post(bodyParser.json(), function(req, res, next) {
  logReq(req.log, req);

  var data = {}
  data.name = req.body.name;
  data.albumIdList = req.body.albumIdList;

  //post editor
  models.Editor.create(data)
  .then(function(editor) {
    res.statusCode = 201;
    res.send(editor);
    req.log.info({editor:editor}, "Post new editor");
    logRes(req.log, res);
  })
  
  //error handling
  .catch (function(err) {
    if(!(err instanceof PromiseReject)) {
      req.log.error({err:err}, "Unknown error");
      errHandle.unknown(res, err);
    }
  });
});

/**
 * Get a selected editor choice
 */
router.route('/editor/:id')
.get(function(req,res,next) {
  logReq(req.log, req);

  //find editor
  function findEditor() {
    var id = req.params.id;
    return models.Editor
    .findById(id)
    .populate('albumIdList');
  }

  //assure editor exist
  function assureEditorExist(editor) {
    if(!editor) {
      var msg = "Editor not found by id " + id;
      req.log.warn(msg);
      errHandle.notFound(res, msg);
      throw new PromiseReject();
    }

    return editor;
  }

  //populate with photos
  function populatePhotos(editor) {
    return models.Album.populate(
      editor.albumIdList, 
      {path: 'photoIdList',});
  }

  //respond
  function respond(editor) {
    res.send(editor);
    req.log.info({editor:editor}, "Get editor");
    logRes(req.log, res);
  }

  /*
   * findEditor -> assureEditorExist ----------------------|->respond
   *                                  |                    |
   *                                  |-> populatePhotos ->|
   */
  var getEditor = findEditor().then(assureEditorExist);
  Promise.join(
    getEditor,
    getEditor.populatePhotos,

    respond
  )
  //error handling
  .catch (function(err) {
    if(!(err instanceof PromiseReject)) {
      req.log.error({err:err}, "Unknown error");
      errHandle.unknown(res, err);
    }
  });
});

module.exports = router;
