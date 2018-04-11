const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/user');
const Member = require('../models/member');
const multer = require('multer');
const cloudinary = require('cloudinary');
const cloudinaryStorage = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
});

var storage = cloudinaryStorage({
  cloudinary: cloudinary,
  folder: 'rccgportal',
  allowedFormats: ['jpg', 'png'],
  filename: function (req, file, cb) {
    cb(undefined, 'imgSrc' + Date.now());
  }
});

let upload = multer({ storage: storage });

//restrict accces to not-loggedin users
let restrictAccess = function(req,res, next){
	if(req.user){
	  next();
	}
	else{
    //req.flash('info', 'You must be logged in to perform this action');
	  res.render('login');
	}
}

// route requires user to be loggedout
let requireLogout = function(req,res,next){
  if(req.user){
    res.redirect('/'); // Redirect to the dashbaord if the user is aleady logged in
  }
  else{
    next()  // Run the next middleware if the user is logged in
  }
}

//allow access to Master only.
let masterLogin = function(req,res,next){
  bcrypt.compare(process.env.masterPassword,  function(err, response) {
    if(err) throw err;
    console.log(response);
    // res === true || res === false
    if(req.user.username == process.env.masterUsername && response == true){
      next();
    }
    else{
      res.render('login');
    }
  });
}
/* GET home page. */
router.get('/', restrictAccess, function(req, res, next) {
  User.findOne({_id:req.user.id}).
  populate('memberRef').
  exec((err,user)=>{
    console.log(user);
    res.render('index', {
      title: 'Welcome To Your Portal',
      user:user
    });
  })
});


// === REGISTER NEW MEMBERS/PARTICIPANTS ===
router.get('/register', restrictAccess,  (req,res,next)=>{
    req.user.populate('memberRef', function(err,user){
      console.log(user);
      if(req.user.memberRef != null){ // If a user is already registered and tries to access this route
        req.flash('info', 'You have already been registered!')
        res.redirect('/'); //redirect him to the homepage
      }
      else{
        res.render('register', {
          title:'Registeration Form',
          user:user
        })
      }
      
    })
});

// GET CREATE ACOUNT VIEW
router.get('/new', (req, res) => {
  res.render('createacc', {title:'Create Account'});
});

// Create New Account
router.post('/new', requireLogout, function(req,res,next){
  req.checkBody('name', 'Please provide your full name').notEmpty();
  req.checkBody('username', 'Please provide a username').notEmpty();
  req.checkBody('email', 'Please provide a valid email address').isEmail();
  req.checkBody('password', 'password cannot be empty').notEmpty();
  req.checkBody('password2', 'passwords do not match').equals(req.body.password);
  
  //create a new user
  let user = new User({
    name: req.body.name,
    username:req.body.username,
    email: req.body.email,
    password: req.body.password,
    pin:'',
    memberRef:null
  });
  
  //Run the validators
  let errors = req.validationErrors();
  
  //if there are errors in the form
  if(errors){
    req.flash('error', errors);
    res.render('createacc',  {
    title: 'Create Account',
    errors: errors,
    name:req.body.name,
    username:req.body.username,
    email:req.body.email
    });
    return;
  }
  
  //there are no errors
  else{
    //check if ther username is already taken
    User.findOne({'username': req.body.username}, function(err, result){
    if(err){return next(err)}
    User.count({name:req.body.name}, function(err, sameNameNo){
      console.log('found user with the same name' + sameNameNo);
    })
    //if the username is truely already in user by another user
    if(result){
      console.log('username is already taken');
      req.flash('info', 'Sorry, username is already taken');
      res.render('createacc',{
      title:'Create Account',
      name:req.body.name,
      username:req.body.username,
      email:req.body.email
      });
    }
  
    //the username is not taken
    else{
      bcrypt.hash(user.password, 10, function(err, hash){
      if(err) throw err;
      //set hashed password
      user.password = hash;
      user.save(function(err){
        if(err){return next(err)}
        console.log(user);
        //res.redirect('/users/login');
        req.login(user, function(err) {
        if (err) { return next(err); }
        return res.redirect('/register');
        });
      });
      })
      
    } 
    });
  }
  });


  //handle login route
passport.serializeUser(function(user, done){
  done(null, user.id);
});
passport.deserializeUser(function(id, done){
  User.findById(id, function(err, user){
    done(err, user);
  });
});
passport.use(new LocalStrategy(
  function(username, password, done){
    User.findOne({username: username}, function(err, user){
      if(err) {return done(err)}
      if(!user){
        console.log('incorrect username');
        return done(null, false, {message: 'Incorrect username.'});
      }
      bcrypt.compare(password, user.password, function(err, res) {
        if(err) throw err;
        console.log(res);
        // res === true || res === false
        if(res !== true){
        return done(null, false, {message: 'Incorrect password.'});
        }
        else{
        console.log('user has been successfully authenticated');
        return done(null, user);
        }
      });
    });
  }
));

// POST == REGISTER NEW MEMBERS/PARTICIPANT
router.post('/register', restrictAccess, upload.single('imgSrc'), (req,res,next)=>{
  // Run Validation
  req.checkBody('imgSrc', 'Please provide a valid image').notEmpty();
  req.checkBody('parish', 'pasish cannot be empty').notEmpty();
  req.checkBody('area', 'area cannot be empty').notEmpty();
  req.checkBody('zone', 'zone cannot be empty').notEmpty();
  req.checkBody('interest', 'interest cannot be empty').notEmpty();
  let errors = req.validationErrors();
  if(errors){
    User.findOne({_id:req.user._id}).
    populate('memberRef').
    exec((err,user)=>{
      if(err) return handleError();
      req.flash('error', errors);
      res.render('register', {
        title:'Registration form',
        user:user
      })
    })
  }
  else{
    let today = new Date();
    let year = today.getFullYear();
    Member.count({}).
    exec((err,count)=>{
      console.log(count);
      let member = new Member({
        _id:new mongoose.Types.ObjectId(),
        name:req.user.name,
        email:req.body.email,
        imgSrc:req.file ? req.file.url : '/images/avatar.png',
        parish:req.body.parish,
        zone:req.body.zone,
        area:req.body.area,
        interest:req.body.interest,
        userRef:req.user._id,
        regNo:`Eb1/${year}/${count + 1000}`
      });

      member.save((err,done)=>{
        if(err) throw err;
        console.log(done);
        //console.log('Registration Successfull...');
        User.update({_id:req.user._id},{memberRef:member._id}, (err,ok)=>{
          console.log(ok);
          req.flash('success', 'Registration Successful');
          res.redirect('/print');
        });
      })
    });
  }
});

// print
router.get('/print', restrictAccess, (req,res,next)=>{
  Member.find({userRef:req.user._id}).populate('userRef').
  exec((err,member)=>{
    if(err) throw err;
    console.log(member);
    res.render('print', {
      title:'Print Registration Form',
      member:member
    });
  });   
});

// GET == UPDATE PROFILE
router.get('/update', restrictAccess, (req,res,next)=>{
  User.findOne({_id:req.user._id}).
  populate('memberRef').
  exec((err,user)=>{
    if(err) return handleError();
    //console.log(user);
    res.render('update', {
      title:'Update Profile',
      user:user
    })
  })
});

// Post == Update profile
router.post('/update', restrictAccess, (req,res,next)=>{
  req.checkBody('parish', 'parish cannot be empty').notEmpty();
  req.checkBody('zone', 'zone cannot be empty').notEmpty();
  req.checkBody('area', 'area field cannot be empty').notEmpty();
  req.checkBody('interest', 'interest field cannot be empty').notEmpty();

  let errors = req.validationErrors();
  User.findOne({_id:req.user._id}).
  populate('memberRef').
  exec((err,user)=>{
    if(errors){
      req.flash('error', errors);
      res.render('update',{
        title:'Update Profile',
        errors:errors,
        user:user
      })
    }
    else{
      Member.update({_id:user.memberRef._id},{
        parish:req.body.parish,
        area:req.body.area,
        zone:req.body.zone,
        interest:req.body.interest
      }, (err,done)=>{
        if(err) throw err;
        console.log(done);
        req.flash('success', 'profile updated successfuly...');
        res.redirect('/');
      });
    }
  })
  
});
router.post('/login', requireLogout,
  passport.authenticate('local', {failureRedirect:'/', failureFlash:'authentication failed'}),
  function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    // res.redirect('/users/' + req.user.username);
    req.flash('success', 'Welcome back');
    res.redirect('/');
});

// Logout
router.get('/logout', function(req, res, next){
  req.flash('info', 'You are logged out');
	req.session.destroy(function(err){
    //console.log('user logged out... session deleted.')
	  res.redirect('/')
	});
});


module.exports = router;
