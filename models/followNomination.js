const mongoose = require('mongoose');

const followNominationSchema = new mongoose.Schema({
  userID: String,
  followingID: String,
});

module.exports = mongoose.model('FollowNomination', followNominationSchema);
