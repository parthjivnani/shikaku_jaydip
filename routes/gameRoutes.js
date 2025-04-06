const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

/**
 * Game API Routes
 * Handles board creation, game generation, and rectangle manipulation
 */

// Create new game board
router.post('/board', gameController.createBoard);

// Generate new puzzle
router.get('/rectangles', gameController.generateGame);

// Lock/unlock rectangle operations
router.post('/lock-rectangle', gameController.lockRectangle);
router.post('/unlock-rectangle', gameController.unlockRectangle);

module.exports = router; 