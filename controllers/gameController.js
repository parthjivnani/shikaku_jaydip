const Game = require('../models/Game');
const { generateGameId, generateRectangles, checkRectangleOverlap, checkGameCompletion } = require('../utils/gameUtils');

/**
 * Creates a new game board with specified dimensions
 * Returns a new game ID and board dimensions
 */
const createBoard = async (req, res) => {
    const { width, height } = req.body;
    if (!width || !height || width < 1 || height < 1) {
        return res.status(400).json({ error: 'Invalid board dimensions' });
    }

    const gameId = generateGameId();
    res.json({ gameId, dimensions: { width, height } });
};

/**
 * Generates a new Shikaku puzzle
 * Creates rectangles, stores game state in DB, and returns initial board state
 */
const generateGame = async (req, res) => {
    const rows = parseInt(req.query.rows) || 5;
    const cols = parseInt(req.query.cols) || 5;

    const rectangles = generateRectangles(rows, cols);
    const gameId = generateGameId();

    try {
        // Delete ALL existing games to ensure clean state
        await Game.deleteMany({});

        // Create new game in MongoDB with empty locked rectangles array
        const newGame = new Game({
            gameId,
            rows,
            cols,
            rectangles,
            lockedRectangles: [],
            isComplete: false,
            isWon: false
        });

        await newGame.save();
        
        res.json({
            gameId,
            rows,
            cols,
            rectangles
        });
    } catch (error) {
        console.error('Error saving game:', error);
        res.status(500).json({ error: 'Failed to create new game' });
    }
};

/**
 * Locks a rectangle on the game board
 * Validates rectangle position, size, and checks for overlaps
 * Updates game state and checks for win condition
 */
const lockRectangle = async (req, res) => {
    const { gameId, start, end } = req.body;
    
    if (!gameId) {
        return res.status(400).json({ error: 'Game ID is required' });
    }

    try {
        // Find the game in MongoDB
        const game = await Game.findOne({ gameId });
        if (!game) {
            return res.status(400).json({ error: 'Invalid game ID or no active game' });
        }

        // Update the game's updatedAt timestamp
        game.updatedAt = new Date();
        await game.save();

        if (!start || !end || 
            typeof start.x !== 'number' || typeof start.y !== 'number' ||
            typeof end.x !== 'number' || typeof end.y !== 'number') {
            return res.status(400).json({ error: 'Invalid rectangle coordinates' });
        }

        // Calculate rectangle dimensions
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const area = width * height;

        // Check if the selected area contains exactly one number cell
        let numberCell = null;
        let numberCellArea = null;

        // Find the number cell in the selected area
        for (const rect of game.rectangles) {
            if (rect.numberCell.x >= minX && rect.numberCell.x <= maxX &&
                rect.numberCell.y >= minY && rect.numberCell.y <= maxY) {
                if (numberCell) {
                    return res.status(400).json({ error: 'Area contains multiple number cells' });
                }
                numberCell = rect.numberCell;
                numberCellArea = rect.area;
            }
        }

        if (!numberCell) {
            return res.status(400).json({ error: 'Area must contain exactly one number cell' });
        }

        // Check if the area matches the number cell's area
        if (area !== numberCellArea) {
            return res.status(400).json({ error: 'Selected area size does not match the number' });
        }

        // Create the new rectangle to check for overlaps
        const newRect = {
            x: minX,
            y: minY,
            width,
            height
        };

        // Check for overlapping with existing locked rectangles
        for (const lockedRect of game.lockedRectangles) {
            if (checkRectangleOverlap(newRect, lockedRect)) {
                return res.status(400).json({ 
                    error: 'Area overlaps with locked rectangle',
                    overlappingRect: lockedRect
                });
            }
        }

        // Create the new locked rectangle
        const newLockedRect = {
            ...newRect,
            area,
            numberCell
        };

        // Add to locked rectangles and update the game
        game.lockedRectangles.push(newLockedRect);
        game.isComplete = game.lockedRectangles.length === game.rectangles.length;
        
        if (game.isComplete) {
            const { isComplete, isWon } = checkGameCompletion(game);
            game.isComplete = isComplete;
            game.isWon = isWon;
        }

        // Save the updated game state
        await game.save();

        res.json({
            success: true,
            isComplete: game.isComplete,
            isWon: game.isWon,
            rectangle: newLockedRect
        });
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ error: 'Failed to update game state' });
    }
};

/**
 * Unlocks a previously locked rectangle at given coordinates
 * Updates game state to reflect the removed rectangle
 */
const unlockRectangle = async (req, res) => {
    const { gameId, x, y } = req.body;
    
    if (!gameId) {
        return res.status(400).json({ error: 'Game ID is required' });
    }

    if (typeof x !== 'number' || typeof y !== 'number') {
        return res.status(400).json({ error: 'Invalid coordinates' });
    }

    try {
        // Find the game in MongoDB
        const game = await Game.findOne({ gameId });
        if (!game) {
            return res.status(400).json({ error: 'Invalid game ID or no active game' });
        }

        // Find the locked rectangle at the given coordinates
        const rectIndex = game.lockedRectangles.findIndex(rect => 
            x >= rect.x && x < rect.x + rect.width &&
            y >= rect.y && y < rect.y + rect.height
        );

        if (rectIndex === -1) {
            return res.status(400).json({ error: 'No locked rectangle found at the specified coordinates' });
        }

        // Remove the rectangle from locked rectangles
        const removedRect = game.lockedRectangles.splice(rectIndex, 1)[0];

        // Update game state
        game.isComplete = false;
        game.isWon = false;
        game.updatedAt = new Date();

        // Save the updated game state
        await game.save();

        res.json({
            success: true,
            rectangle: removedRect
        });
    } catch (error) {
        console.error('Error unlocking rectangle:', error);
        res.status(500).json({ error: 'Failed to unlock rectangle' });
    }
};

module.exports = {
    createBoard,
    generateGame,
    lockRectangle,
    unlockRectangle
}; 