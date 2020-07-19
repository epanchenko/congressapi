const express = require('express');

const committeeController = require('../controllers/committeeController');
const {
  getCommittee,
  getAllCommittees,
  getMembers,
  getSubCommittees,
} = committeeController;
const router = express.Router();

router.route('/committee/committeeID/:committeeID').get(getCommittee);
router.route('/committee/committeeID/:committeeID/members').get(getMembers);
router
  .route('/committee/committeeID/:committeeID/subcommittees')
  .get(getSubCommittees);
router.route('/allCommittees/').get(getAllCommittees);

module.exports = router;
