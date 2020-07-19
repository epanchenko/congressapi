const express = require('express');

const nominationController = require('../controllers/nominationController');
const {
  getAllNominations,
  getAllNominationsLastKey,
  getNominationID,
  getActions,
} = nominationController;

const router = express.Router();

router.route('/all').get(getAllNominations);
router
  .route('/all/nominationID/:nominationID/latestActionDate/:latestActionDate')
  .get(getAllNominationsLastKey);
router.route('/nomination/nominationID/:nominationID').get(getNominationID);
router.route('/nomination/nominationID/:nominationID/actions').get(getActions);

module.exports = router;
