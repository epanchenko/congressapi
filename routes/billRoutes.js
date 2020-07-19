const express = require('express');

const billController = require('../controllers/billController');
const {
  getBillID,
  getBillSummary,
  getActions,
  getAmendments,
  getCommittees,
} = billController;

const router = express.Router();

router.route('/bill/billID/:billID').get(getBillID);
router.route('/billSummary/billID/:billID').get(getBillSummary);
router.route('/bill/billID/:billID/actions').get(getActions);
router.route('/bill/billID/:billID/amendments').get(getAmendments);
router.route('/bill/billID/:billID/committees').get(getCommittees);

module.exports = router;
