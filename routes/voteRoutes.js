const express = require('express');

const voteController = require('../controllers/voteController');
const {
  getLegislatorVotes,
  getLegislatorVotesLastKey,
  getVoteForBillID,
  getVoteForBillIDLastKey,
  getVoteForNominationID,
  getVoteDetail,
  getVotesAll,
  getVotesAllLastKey,
} = voteController;

const router = express.Router();

router.route('/legislator/:legislatorID/').get(getLegislatorVotes);
router
  .route('/legislator/:legislatorID/rollID/:rollID/votedAt/:votedAt')
  .get(getLegislatorVotesLastKey);
router.route('/billID/:billID').get(getVoteForBillID);
router
  .route('/billID/:billID/rollID/:rollID/votedAt/:votedAt')
  .get(getVoteForBillIDLastKey);
router
  .route('/nomination/nominationID/:nominationID')
  .get(getVoteForNominationID);
router.route('/vote/rollID/:rollID').get(getVoteDetail);
router.route('/all').get(getVotesAll);
router.route('/all/rollID/:rollID/votedAt/:votedAt').get(getVotesAllLastKey);
module.exports = router;
