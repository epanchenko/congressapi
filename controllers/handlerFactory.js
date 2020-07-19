const catchAsync = require('../utils/catchAsync');

exports.deleteFollowing = (Model) => async (req, res, next) => {
  await Model.deleteOne(
    { followingID: req.params.id, userID: req['user'] },
    function (err) {
      if (err) {
        res.status(409).json({
          error: err.name,
        });
      } else {
        res.status(201).json({ status: 'success' });
      }
    }
  );
};

exports.createFollowing = (Model) =>
  catchAsync(async (req, res, next) => {
    await Model.create({ ...req.body, userID: req['user'] }, function (
      err,
      doc
    ) {
      if (err) {
        if ((err.code = 11000)) {
          res.status(409).json({
            status: 'Already created',
          });
        } else {
          res.status(500).json({
            error: err.name,
          });
        }
      } else {
        res.status(201).json({
          status: 'success',
          data: doc,
        });
      }
    });
  });

exports.findFollowing = (Model) =>
  catchAsync(async (req, res, next) => {
    if (req['user']) {
      const doc = await Model.find({
        userID: req['user'],
        followingID: req.params.id,
      });
      if (doc.length !== 0)
        res.status(200).json({
          status: 'found',
        });
      else
        res.status(200).json({
          status: 'not found',
        });
    } else {
      res.sendStatus(204);
    }
  });

exports.getFollowing = (Model) =>
  catchAsync(async (req, res, next) => {
    if (req['user']) {
      await Model.find({ userID: req['user'] })
        .select('followingID -_id')
        .lean()
        .exec(function (err, docs) {
          const following = [];

          for (let i = 0; i < docs.length; i++) {
            following.push({ followingID: docs[i].followingID });
          }

          if (err) {
            res.status(500);
          } else {
            res.status(200).json({
              status: 'success',
              following,
            });
          }
        });
    } else {
      res.status(401).json({
        status: 'Not authorized',
        following: [],
      });
    }
  });
