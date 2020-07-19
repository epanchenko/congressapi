const mongoose = require('mongoose');

const followBillSchema = new mongoose.Schema({
  userID: String,
  followingID: String,
});

module.exports = mongoose.model('FollowBill', followBillSchema);
