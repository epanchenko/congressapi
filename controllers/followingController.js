const factory = require('./handlerFactory');
const FollowLegislator = require('../models/followLegislator');
const FollowBill = require('../models/followBill');
const FollowNomination = require('../models/followNomination');
const FollowCommittee = require('../models/followCommittee');

exports.createLegislator = factory.createFollowing(FollowLegislator);
exports.deleteLegislator = factory.deleteFollowing(FollowLegislator);
exports.getLegislators = factory.getFollowing(FollowLegislator);
exports.findLegislator = factory.findFollowing(FollowLegislator);

exports.createBill = factory.createFollowing(FollowBill);
exports.deleteBill = factory.deleteFollowing(FollowBill);
exports.getBills = factory.getFollowing(FollowBill);
exports.findBill = factory.findFollowing(FollowBill);

exports.createNomination = factory.createFollowing(FollowNomination);
exports.deleteNomination = factory.deleteFollowing(FollowNomination);
exports.getNominations = factory.getFollowing(FollowNomination);
exports.findNomination = factory.findFollowing(FollowNomination);

exports.createCommittee = factory.createFollowing(FollowCommittee);
exports.deleteCommittee = factory.deleteFollowing(FollowCommittee);
exports.getCommittees = factory.getFollowing(FollowCommittee);
exports.findCommittee = factory.findFollowing(FollowCommittee);
