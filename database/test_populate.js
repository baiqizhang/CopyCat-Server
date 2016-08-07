'use strict';

var db = require('./database.js');
var Album = require('./album.js');
var Photo = require('./photo.js');
var User = require('./user.js');
var Editor = require('./editor.js');

db.once('open', function() {
  //create a super user
  var superUserId;
  var createUsers = function() {
    User.create({name: "copy cat"}, function(err, user) {
      errHandle(err),
      superUserId = user._id;
      console.log(user);
      createPhotos();
    });
  }
  
  //save test photos
  var photoIdList = [];
  var fakePhotoNum = 100;
  var createPhotos = function() {
    var photoUrlList = [
      'https://s3.amazonaws.com/copycatimage/elephant.jpg',
      'https://s3.amazonaws.com/copycatimage/island.jpg',
      'https://s3.amazonaws.com/copycatimage/land.jpeg',
      'https://s3.amazonaws.com/copycatimage/portal.jpg',
      'https://s3.amazonaws.com/copycatimage/people.jpg'
    ];
    for(var i = 0; i < fakePhotoNum; i++) {
      Photo.create({
          imageUrl: photoUrlList[i % photoUrlList.length],
          ownerId: superUserId,
          tagList: ['cool', 'awesome', 'interesting']
      }, function(err, photo) {
        errHandle(err);
        photoIdList.push(photo._id);
        console.log("%j", photo);
        if(photoIdList.length === fakePhotoNum) {
          createAlbums();
        }
      });
    }
  }

  //save test albums
  var albumIdList = [];
  var albumImageUrl = ['https://s3.amazonaws.com/copycatimage/cmu.jpg', 'https://s3.amazonaws.com/copycatimage/IMG_0407.JPG'];
  var albumNameList = ['nature', 'documentary', 'sky', 'slow motion']
  var fakeAlbumNum = 100;
  var createAlbums = function() {
    for(var i = 0; i < fakeAlbumNum; i++) {
      Album.create({
          name: albumNameList[i % albumNameList.length],
          imageUrl: albumImageUrl[i % albumImageUrl.length],
          photoIdList:[photoIdList[i % photoIdList.length], photoIdList[(i+1) % photoIdList.length]],
          ownerId:superUserId,
          tagList: ['wonderful', 'great', 'amazing']
      }, function(err, album) {
        errHandle(err);
        albumIdList.push(album._id);
        console.log("%j", album);
        if(albumIdList.length === fakeAlbumNum) {
          createEditorChoice();
        }
      });
    }
  }

  //save editor choice
  var createEditorChoice = function() {
    Editor.create({
        name: 'editor choice test',
        albumIdList:[albumIdList[0], albumIdList[1], albumIdList[2]]
    }, function(err, editor) {
      errHandle(err);
      console.log(editor);
    });
  }

  //begin from creating user
  createUsers();
});

var errHandle = function(err) {
  if(err) console.error(err);
}
