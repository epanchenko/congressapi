const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const ejs = require('ejs');

const legislatorRouter = require('./routes/legislatorRoutes');
const billRouter = require('./routes/billRoutes');
const voteRouter = require('./routes/voteRoutes');
const committeeRouter = require('./routes/committeeRoutes');
const nominationRouter = require('./routes/nominationRoutes');
const authRouter = require('./routes/authRoutes');
const followingRouter = require('./routes/followingRoutes');

const { retrieveUserIdFromRequest } = require('./controllers/authController');

const app = express();
app.use(cookieParser());

app.use(retrieveUserIdFromRequest);

app.use(bodyParser.json());

app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);

//app.set('views', path.join(__dirname, 'views'));

//serving static files

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');

app.use(cors()); // could limit to certain routes by passing in as middleware

// pre flight options
app.options('*', cors());

// middlewares
app.use(express.static(path.join(__dirname, 'public')));

// limit requests from same api
// one thousand in an hour

const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour',
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/' + 'default.html'));

  res.sendfile('default.html', { root: __dirname + '/public/' });
});

app.use('/api', limiter);

//to get form data
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Set security HTTP headers
app.use(helmet());

// dev logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parser, reading data from body into req.body
app.use(
  express.json({
    limit: '10kb',
  })
);

// Data sanitization against NOSQL query injection
// gets rid of $'s etc.

app.use(mongoSanitize());

// Data sanitization against XSS attacks
app.use(xss());

//compress text sent to clients
app.use(compression());

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// routes

app.use('/api/v1/auth/', authRouter);
app.use('/api/v1/legislators/', legislatorRouter);
app.use('/api/v1/bills/', billRouter);
app.use('/api/v1/votes/', voteRouter);
app.use('/api/v1/committees/', committeeRouter);
app.use('/api/v1/nominations/', nominationRouter);
app.use('/api/v1/following/', followingRouter);

app.all('*', (req, res, next) => {
  res.sendStatus(404);
  // next(new AppError(`Can't find ${req.originalUrl}`, 404)); // if you pass something in next, it is an error, goes straight to error
});

module.exports = app;
