const mongoose = require('mongoose');

/**
 * Game Schema - Represents a Shikaku puzzle game state
 * Stores board dimensions, all possible rectangles, locked rectangles by player
 * Tracks game completion state and timestamps for game progression
 */
const gameSchema = new mongoose.Schema({
    // Unique identifier for each game instance
    gameId: { type: String, required: true, unique: true },
    
    // Board dimensions
    rows: { type: Number, required: true },
    cols: { type: Number, required: true },
    
    // Array of all possible rectangles in the game
    rectangles: [{
        x: Number,          // X coordinate of top-left corner
        y: Number,          // Y coordinate of top-left corner
        width: Number,      // Width of rectangle
        height: Number,     // Height of rectangle
        area: Number,       // Total area of rectangle
        numberCell: {       // Position of the number cell within rectangle
            x: Number,
            y: Number
        },
        locked: Boolean     // Whether rectangle is locked in place
    }],
    
    // Array of rectangles that have been locked by the player
    lockedRectangles: [{
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        area: Number,
        numberCell: {
            x: Number,
            y: Number
        }
    }],
    
    // Game state flags
    isComplete: { type: Boolean, default: false },  // Whether all rectangles are placed
    isWon: { type: Boolean, default: false },       // Whether game is won
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema); 