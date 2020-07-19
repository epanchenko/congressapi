const mongoose = require('mongoose');

const followLegislatorSchema = new mongoose.Schema({
  userID: String,
  followingID: String,
});

module.exports = mongoose.model('FollowLegislator', followLegislatorSchema);
