const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/user');
const Member = require('../models/member');
const Hashpin = require('../models/hashpin');
const Unhashpin = require('../models/unhashpin');
const multer = require('multer');
const cloudinary = require('cloudinary');
const cloudinaryStorage = require('multer-storage-cloudinary');
const Random = require("random-js");

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
  bcrypt.compare(process.env.masterPassword,req.user.password,  function(err, response) {
    if(err) throw err;
    console.log(process.env.masterPassword)
    console.log(req.user.password)
    console.log(response);
    // res === true || res === false
    if(req.user.username === process.env.masterUsername && response === true){
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
    //console.log(user);
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
  req.checkBody('pin', 'Please provide your pin').notEmpty();
  req.checkBody('password', 'password cannot be empty').notEmpty();
  req.checkBody('password2', 'passwords do not match').equals(req.body.password);
  
  //create a new user
  let user = new User({
    name: req.body.name,
    username:req.body.username,
    password: req.body.password,
    pin:req.body.pin,
    memberRef:null
  });
  
  //Run the validators
  let errors = req.validationErrors();
  
  //if there are errors in the form
  if(errors){
    res.render('createacc',  {
      title: 'Create Account',
      errors: errors,
      user:user
    });
    return;
  }
  
  //there are no errors
  else{
    //check if ther username is already taken
    User.findOne({'username': req.body.username}, function(err, result){
    if(err){return next(err)}

    //if the username is truely already in user by another user
    if(result){
      console.log('username is already taken');
      req.flash('error', 'Sorry, username is already taken');
      res.render('createacc',{
      title:'Create Account',
      user:user
      });
    }
  
    //the username is not taken
    else{
      // check if the pin is correct
      Unhashpin.findOne({_id:'5ad098cda18116140cfa5b38'},(err,thePin)=>{
        console.log(req.body.pin.toString());
        if(err) throw err;
        console.log(thePin)
        if(thePin.pin.indexOf(req.body.pin.toString()) === -1){
          console.log(thePin.pin.indexOf(req.body.pin.toString()))
          req.flash('error', 'Incorrect pin')
          res.render('createacc',{
            title:'Create Account',
            user:user
          });
        }
        else{
          console.log(thePin.pin.indexOf(req.body.pin.toString()))
          bcrypt.hash(user.password, 10, function(err, hash){
            if(err) throw err;
            //set hashed password
            user.password = hash;
            user.save(function(err){
              if(err){return next(err)}
              // delete the pin
              let foo = thePin.pin
              foo.splice(foo.indexOf(req.body.pin),1)
              Unhashpin.update({_id:'5ad098cda18116140cfa5b38'},{pin:foo},(err,done)=>{ // update the pin array
                //res.redirect('/users/login');
                req.login(user, function(err) {
                  if (err) { return next(err); }
                  req.flash('success', 'Account created successfully')
                  return res.redirect('/register');
                });
              })
            });
          })
        }
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
  //req.checkBody('imgSrc', 'Please provide a valid image').notEmpty();
  req.checkBody('email', 'Email field cannot be empty').notEmpty();
  req.checkBody('email', 'Please provide a vilid email address').isEmail();
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
      res.render('register', {
        title:'Registration form',
        user:user,
        errors:errors
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


// ==== GENERATE Pin ====
router.get('/auth/secure/gen/pin', (req,res,next)=>{
  let hashArr = [];
  let unhashArr = [];
  for(i=0;i<20;i++){
    var random = new Random(Random.engines.mt19937().autoSeed());
    var randomPin = random.integer(100000000000, 999999999999); // generate random pin
    var hash = bcrypt.hashSync(randomPin.toString()) // hash the pin
    hashArr.push(hash); // push the hashpin to an array
    unhashArr.push(randomPin) // push the unhashpin to array
    //console.log(pinArr);
  }
  let hashpin = new Hashpin({
    pin:hashArr,
    date:new Date()
  }).save((err,done)=>{
    if(err) throw err;
    let unhashpin = new Unhashpin({
      pin:unhashArr,
      date: new Date()
    }).save((err,done)=>{
      if(err) throw err;
      res.json(`${hashArr} ${unhashArr}`)
    })
  })
})
router.post('/login', requireLogout,
  passport.authenticate('local', {failureRedirect:'/', failureFlash:'Incorrect username or password'}),
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

// *******======= ADMIN PANEL=========**********//
router.get('/admin',restrictAccess,  (req, res,next) => {
  if(req.query.length == {}){
    console.log('no query')
    Member.find({}).populate('UserRef').exec((err,members)=>{
      console.log(members);
      res.render('admin', {title:'Admin Panel',members:members});
    })
  }
  else{console.log(req.query)
    let sortby = req.query.sortby;
    let sortval = req.query.sortval;
    Member.find({[sortby]:sortval}).populate('UserRef').exec((err,members)=>{
      console.log(members);
      res.render('admin', {title:'Admin Panel',members:members});
    })
  
  
  }
  
});
module.exports = router;
