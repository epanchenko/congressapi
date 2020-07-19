const express = require('express');

const authController = require('../controllers/authController');

const { register, login, getUser } = authController;

const router = express.Router();

router.route('/register').post(register);
router.route('/login').post(login);
router.route('/user').get(getUser);

module.exports = router;
