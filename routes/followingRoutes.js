const express = require('express');

const followingController = require('../controllers/followingController');

const {
  createLegislator,
  createBill,
  createNomination,
  createCommittee,
  findLegislator,
  findBill,
  findNomination,
  findCommittee,
  getLegislators,
  getBills,
  getNominations,
  getCommittees,
  deleteLegislator,
  deleteBill,
  deleteNomination,
  deleteCommittee,
} = followingController;

const {
  checkIfAuthenticated,
  checkIfAuthenticatedPass,
} = require('../controllers/authController');

const router = express.Router();

router.route('/createLegislator').post(checkIfAuthenticated, createLegislator);
router.route('/createBill').post(checkIfAuthenticated, createBill);
router.route('/createNomination').post(checkIfAuthenticated, createNomination);
router.route('/createCommittee').post(checkIfAuthenticated, createCommittee);

router.route('/getLegislators').get(checkIfAuthenticated, getLegislators);
router.route('/getBills').get(checkIfAuthenticated, getBills);
router.route('/getNominations').get(checkIfAuthenticated, getNominations);
router.route('/getCommittees').get(checkIfAuthenticated, getCommittees);

router
  .route('/findLegislator/:id')
  .get(checkIfAuthenticatedPass, findLegislator);
router.route('/findBill/:id').get(checkIfAuthenticatedPass, findBill);
router
  .route('/findNomination/:id')
  .get(checkIfAuthenticatedPass, findNomination);
router.route('/findCommittee/:id').get(checkIfAuthenticatedPass, findCommittee);

router
  .route('/deleteLegislator/:id')
  .delete(checkIfAuthenticated, deleteLegislator);
router.route('/deleteBill/:id').delete(checkIfAuthenticated, deleteBill);
router
  .route('/deleteNomination/:id')
  .delete(checkIfAuthenticated, deleteNomination);
router
  .route('/deleteCommittee/:id')
  .delete(checkIfAuthenticated, deleteCommittee);

module.exports = router;
