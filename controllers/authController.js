const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const catchAsync = require('../utils/catchAsync');
const User = require('../models/user');
const RSA_PRIVATE_KEY = fs.readFileSync('private.key');

const createSessionToken = (user) => {
  return jwt.sign(
    {
      name: user.name,
    },
    RSA_PRIVATE_KEY,
    {
      expiresIn: 7200,
      algorithm: 'RS256',
      subject: user._id.toString(),
    }
  );
};

exports.login = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(403).json({ error: 'Invalid login' });
  }

  const isPasswordValid = await bcrypt.compare(
    req.body.password,
    user.password
  );

  if (!isPasswordValid) {
    return res.status(403).json({ error: 'Invalid login' });
  }

  const sessionToken = createSessionToken(user);

  res.status(200).json({
    token: sessionToken,
    expiresIn: 7200,
    name: user.name,
    id: user._id,
    email: user.email,
  });
});

exports.register = catchAsync(async (req, res, next) => {
  let userExists = false;

  await User.countDocuments({ email: req.body.email }, function (err, count) {
    if (err || count > 0) {
      userExists = true;
    }
  });

  if (userExists) {
    res.status(409).send({
      error: 'Email address already exists',
    });
  } else {
    const passwordDigest = await bcrypt.hash(req.body.password, 12);

    await User.create(
      {
        name: req.body.name,
        email: req.body.email,
        password: passwordDigest,
      },
      function (error, registeredUser) {
        if (error) {
          res.status(500).send({
            error,
          });
        } else {
          res.status(200).json({
            token: createSessionToken(registeredUser),
            expiresIn: 7200,
            name: registeredUser.name,
            id: registeredUser._id,
            email: registeredUser.email,
          });
        }
      }
    );
  }
});

exports.checkIfAuthenticated = catchAsync(async (req, res, next) => {
  if (req['user']) {
    next();
  } else {
    res.sendStatus(403);
  }
});

exports.checkIfAuthenticatedPass = catchAsync(async (req, res, next) => {
  if (req['user']) {
    next();
  } else {
    res.sendStatus(204);
  }
});

exports.retrieveUserIdFromRequest = catchAsync(async (req, res, next) => {
  if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ')[1];

    let userInfo;

    try {
      const publicKey = fs.readFileSync('./public.key');

      userInfo = jwt.verify(token, publicKey);
    } catch (error) {
      return next();
    }

    if (typeof userInfo === 'undefined') {
      return next();
    }

    await User.findById(userInfo.sub, 'name email _id', (err, user) => {
      if (err) {
        next();
      } else {
        req['user'] = user._id;
        next();
      }
    });
  } else {
    next();
  }
});

exports.getUser = catchAsync(async (req, res, next) => {
  if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ')[1];

    let userInfo;

    try {
      const publicKey = fs.readFileSync('./public.key');

      userInfo = jwt.verify(token, publicKey);
    } catch (error) {
      return res.sendStatus(403);
    }

    if (typeof userInfo === 'undefined') {
      return res.sendStatus(403);
    }

    await User.findById(userInfo.sub, 'name email _id', (err, user) => {
      if (err) {
        return res.sendStatus(403);
      } else {
        res
          .status(200)
          .json({ name: user.name, email: user.email, id: user._id });
      }
    });
  } else {
    res.sendStatus(204);
  }
});
