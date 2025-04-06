const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// Game routes
router.post('/board', gameController.createBoard);
router.get('/rectangles', gameController.generateGame);
router.post('/lock-rectangle', gameController.lockRectangle);
router.post('/unlock-rectangle', gameController.unlockRectangle);

module.exports = router; 