const express = require('express');

const legislatorController = require('../controllers/legislatorController');
const {
  getLocDist,
  getAllLegislators,
  getLegislatorByID,
  getDistrictCoordinates,
  getLegislatorByIDSum,
  getTermsByID,
  getCommittees,
} = legislatorController;

const router = express.Router();

router.route('/locDists/:lnglat').get(getLocDist);
router.route('/allLegislators').get(getAllLegislators);
router.route('/legislator/:legislatorID').get(getLegislatorByID);
router.route('/legislator/summary/:legislatorID').get(getLegislatorByIDSum);
router.route('/legislator/terms/:legislatorID').get(getTermsByID);
router.route('/legislator/:legislatorID/committees').get(getCommittees);
router.route('/coordinates/:district').get(getDistrictCoordinates);
module.exports = router;
