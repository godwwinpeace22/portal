const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const expressValidator = require('express-validator');
const passport = require('passport');
const flash = require('connect-flash');
const mongoose = require('mongoose');
const mongoDB = process.env.database;
const MongoDBStore = require('connect-mongodb-session')(session);
const compression = require('compression');
mongoose.connect(mongoDB);
db = mongoose.connection;
//bind connecton to error event(to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const index = require('./routes/index');

const app = express();
// Set security headers
const helmet = require('helmet');

app.use(compression()); //Compress all routes. // I don't understand the part of the documentation about server-sent events

app.use(helmet())
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(expressValidator());
app.use(require('express-session')({
    secret: 'supersecretecatkeyguyfalsetrue',
    resave: false,
    saveUninitialized: false,
    cookie:{maxAge: 2 * 24 * 60 * 60 * 1000},
    store: new MongoDBStore({
        uri: process.env.database,
        databaseName: 'portal',
        collection: 'sessions'
      })
}));
app.use(flash());
app.use(function(req,res,next){
  res.locals.messages = require('express-messages')(req,res);
  next();
})
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;