const mongoose = require('mongoose');

const followCommitteeSchema = new mongoose.Schema({
  userID: String,
  followingID: String,
});

module.exports = mongoose.model('FollowCommittee', followCommitteeSchema);
