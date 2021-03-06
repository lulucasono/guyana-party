var express = require('express');
var router = express.Router();

// Require the bcrypt package
var fs = require('fs');
var sanitize = require('mongo-sanitize');
var bcrypt = require('bcrypt');
var Q = require('q');
var passport = require('passport');
var LocalStrategy = require('passport-local');
//var Grid = require('gridfs-stream');

var mongoose = require('mongoose');
var url = "mongodb://localhost:27017/guyana-party";

mongoose.connect(url);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'error while connecting'));
db.once('open',function(){
  //var gfs = Grid(db.db, mongoose.mongo);
  console.log("connection OK");
});
//===============MONGODB=================

//==Mongoose model==
var userSchema = mongoose.Schema({
  user: String,
  email: String,
  password: String
});

var eventSchema = mongoose.Schema({
  userId: String,
  name: String,
  date: Date,
  address: String,
  longitude: String,
  latitude: String,
  flyer: String 
});

var User = mongoose.model('User', userSchema);
var Event = mongoose.model('Event', eventSchema);

// ====Gestion d'utilisateur===//
// creation d'utilisateur
function localReg(newUser, newEmail, newPassword) {
  // prevent noSQL injection
  newUser = sanitize(newUser);
  newEmail = sanitize(newEmail);
  newPassword = sanitize(newPassword);

  console.log("localReg");
  //promise declaration
  var deferred = Q.defer();
  //connect to db
  User.findOne({user: newUser},function(err, result) {
    if (err) throw err;
    if (null != result) {
      console.log("EMAIL ALREADY EXIST:", result.email);

      deferred.resolve(0);
    } else {
      User.findOne({email: newEmail},function(err, result) {
        if (err) throw err;
        if (null != result) {
          console.log("USERNAME ALREADY EXIST:", result.user);

          deferred.resolve(1);
        } else {
          // salt and hash password before sending it to database
          newPassword = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
          var user = new User({ user: newUser, email: newEmail, password: newPassword});

          console.log("CREATING USER:", newUser);

          user.save(function(err, res) {
            if (err) throw err;
            console.log("USER CREATED");
            deferred.resolve(user);
          });
        }
      });
    }
  });
  return deferred.promise;
}
  
// authentification d'utilisateur
function localAuth(login, pwd) {
  // prevent noSQL injection
  login = sanitize(login);
  pwd = sanitize(pwd);

  console.log(login);
  //promise declaration
  var deferred = Q.defer();
  //connect to db

  User.findOne({email: login}, function(err, result) {

    console.log("USERNAME NOT FOUND:", login);
    if (err) throw err;
    if (null == result) {
      console.log("USERNAME NOT FOUND:", login);

      deferred.resolve(false);
    } else {
      console.log("FOUND USER: " + result.user);
      // compare pwd to pwd store in db
      if (bcrypt.compareSync(pwd, result.password)){
        deferred.resolve(result);
      } else {
        console.log("AUTHENTICATION FAILED");
        deferred.resolve(false);
      }
    }
  });
  // return promise
  return deferred.promise;
}


//====Gestion evenement===//

// create new event
function newEvent(userId, name, date, longitude, latitude, flyer){
  console.log("newEvent");    
  if (flyer != null){ 
    flyer = newFile(flyer, function(err, result) {
      var event = new Event({ userId: userId, name: name, date: date, longitude: longitude, latitude: latitude, flyer: flyer});
      console.log("CREATING EVENT (with flyer) :", name);
      user.save(function(err, res) {
        if (err) throw err;
        console.log("EVENT CREATED");
      });
    });
  } else {
    var event = new Event({ userId: userId, name: name, date: date, longitude: longitude, latitude: latitude, flyer: flyer});
    console.log("CREATING EVENT (without flyer) :", name);
    user.save(function(err, res) {
      if (err) throw err;
      console.log("EVENT CREATED");
    });
  }
}

//==========GridFS function=========//
function newFile(){
  MongoClient.connect(url, function(err, db) {
    var writestream = Grid.createWriteStream({
        filename: name
    });
    writestream.on('close', function (file) {
      callback(null, file);
    });
    fs.createReadStream(path).pipe(writestream);
  });
}

function getFile(){

}

function deleteFile(){

}

//===============PASSPORT=================

// Passport session setup.
passport.serializeUser(function(user, done) {
  console.log("serializing " + user.user);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log("deserializing " + obj.user);
  done(null, obj);
});

// Use the LocalStrategy within Passport to login users.
passport.use('local-signin', new LocalStrategy(
  { usernameField: 'login', passwordField: 'pwd',passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    console.log("test");
    localAuth(username, password)
    .then(function (user) {
      if (user) {
        console.log("LOGGED IN AS: " + user.user);
        req.session.success = 'You are successfully logged in ' + user.user + '!';
        console.log("LOGGED IN AS: " + user.user);
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT LOG IN");
        req.session.error = 'Could not log user in. Please try again.'; //inform user could not log them in
        req.session.errorCause = 'badLog';
        done(null, user);
      }
    })
    .fail(function (err){
      console.log("erreur");
      console.log(err.body);
    });
  }
));

// Use the LocalStrategy within Passport to Register/"signup" users.
passport.use('local-signup', new LocalStrategy(
  {usernameField: 'newUser', passwordField: 'newPassword', passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username,  password, done) {
    localReg(username, req.body.newEmail, password)
    .then(function (user) {
      if (user == 0) {
        console.log("COULD NOT REGISTER USER");
        req.session.error = 'That email is already in use, please try a different one.'; //inform user could not log them in
        req.session.errorCause = 'email';
        done(null, false);
      }
      else if (user == 1) {
        console.log("COULD NOT REGISTER EMAIL");
        req.session.error = 'That username is already in use, please try a different one.'; //inform user could not log them in
        req.session.errorCause = 'user';
        done(null, false);
      }
      else if (user) {
        console.log("REGISTERED: " + user.user);
        req.session.success = 'You are successfully registered and logged in ' + user.user + '!';
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));


/* GET home page. */
router.get('/', function(req, res, next) {
  if(req.user){
    res.render('index', {user: req.user.user });
  } else{
    res.render('index', { user: '' });
  }
});

router.get('/recherche', function(req, res, next) {
  if(req.user){
    res.render('recherche', {user: req.user.user });
  } else{
    res.render('recherche', {user: '' });
  }
});


router.get('/inscription', function(req, res, next) {
  if(req.user){
    res.redirect('/');
  } else{
    res.render('inscription', {status: req.session.error || [], errorCause: req.session.errorCause });
    req.session.destroy();
  }
});

router.get('/organisme', function(req, res, next) {
  if(req.user){
    res.render('organisme');
  } else {
    res.redirect('/inscription');
  } 
});

router.get('/evenement', function(req, res, next) {
  if(req.user){
    res.render('evenement', {user: 'log' });
  } else{
    res.render('evenement', {user: '' });
  }  
});

router.get('/creation_evenement', function(req, res, next){ 
  if(req.user){
    res.render('creation_evenement');
  } else {
    res.redirect('/inscription');
  } 
});

router.get('/deconnexion', function(req, res){
  var name = req.user.user;
  console.log("LOGGIN OUT " + req.user.user)
  req.logout();
  res.redirect('/');
  req.session.notice = "You have successfully been logged out " + name + "!";
});


/* POST inscription */
router.post('/inscription/ajouter', passport.authenticate('local-signup', {
  successRedirect: '/',
  failureRedirect: '/inscription'
  })
);

/* connection */
router.post('/connection', passport.authenticate('local-signin', { 
  successRedirect: '/',
  failureRedirect: '/inscription'
  })
);

/* creation d'evenement */
router.post('/creation_evenement/ajouter', function(req, res, next){ 
  if(req.user){
    res.render('creation_evenement');
  } else {
    res.redirect('/inscription');
  } 
});

module.exports = router;
