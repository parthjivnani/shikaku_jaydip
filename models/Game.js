const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    gameId: { type: String, required: true, unique: true },
    rows: { type: Number, required: true },
    cols: { type: Number, required: true },
    rectangles: [{
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        area: Number,
        numberCell: {
            x: Number,
            y: Number
        },
        locked: Boolean
    }],
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
    isComplete: { type: Boolean, default: false },
    isWon: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema); 