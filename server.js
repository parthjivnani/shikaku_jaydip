require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const winston = require('winston');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shikaku', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Game Schema
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

const Game = mongoose.model('Game', gameSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Main route
app.get('/', (req, res) => {
    res.render('game');
});

// Logger configuration
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Game logic
class ShikakuGame {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.rectangles = [];
        this.startTime = new Date();
        this.endTime = null;
        this.isComplete = false;
        this.gameId = Math.random().toString(36).substr(2, 9); // Generate unique game ID
    }

    // ... rest of the ShikakuGame class methods ...
}

// API Routes
app.post('/api/board', (req, res) => {
    const { width, height } = req.body;
    if (!width || !height || width < 1 || height < 1) {
        return res.status(400).json({ error: 'Invalid board dimensions' });
    }

    const game = new ShikakuGame(width, height);
    
    logger.info(`Created new board with ID: ${game.gameId}`);
    res.json({ gameId: game.gameId, dimensions: { width, height } });
});

app.get('/api/rectangles', async (req, res) => {
    const rows = parseInt(req.query.rows) || 5;
    const cols = parseInt(req.query.cols) || 5;

    const grid = Array.from({ length: rows }, () => Array(cols).fill(false));
    const rectangles = [];

    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    let attempts = 0;

    while (attempts < 1000) {
        const x = getRandomInt(0, cols - 1);
        const y = getRandomInt(0, rows - 1);

        if (grid[y][x]) {
            attempts++;
            continue;
        }

        const maxWidth = cols - x;
        const maxHeight = rows - y;
        const possibleRects = [];

        for (let w = 1; w <= maxWidth; w++) {
            for (let h = 1; h <= maxHeight; h++) {
                let valid = true;
                for (let dy = 0; dy < h; dy++) {
                    for (let dx = 0; dx < w; dx++) {
                        if (grid[y + dy][x + dx]) {
                            valid = false;
                            break;
                        }
                    }
                    if (!valid) break;
                }

                if (valid) {
                    possibleRects.push({ w, h });
                }
            }
        }

        if (possibleRects.length === 0) {
            attempts++;
            continue;
        }

        const { w, h } = possibleRects[Math.floor(Math.random() * possibleRects.length)];

        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                grid[y + dy][x + dx] = true;
            }
        }

        const numberX = x + getRandomInt(0, w - 1);
        const numberY = y + getRandomInt(0, h - 1);

        rectangles.push({
            x,
            y,
            width: w,
            height: h,
            area: w * h,
            numberCell: {
                x: numberX,
                y: numberY
            },
            locked: false
        });

        attempts = 0;
    }

    // Generate new game ID
    const gameId = Math.random().toString(36).substr(2, 9);

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
            isWon: false,
            createdAt: new Date(),
            updatedAt: new Date()
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
});

app.post('/api/lock-rectangle', async (req, res) => {
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

        // Check for overlapping with existing locked rectangles
        for (const lockedRect of game.lockedRectangles) {
            const rectMinX = lockedRect.x;
            const rectMaxX = lockedRect.x + lockedRect.width - 1;
            const rectMinY = lockedRect.y;
            const rectMaxY = lockedRect.y + lockedRect.height - 1;

            if (!(maxX < rectMinX || minX > rectMaxX || maxY < rectMinY || minY > rectMaxY)) {
                return res.status(400).json({ 
                    error: 'Area overlaps with locked rectangle',
                    overlappingRect: {
                        x: lockedRect.x,
                        y: lockedRect.y,
                        width: lockedRect.width,
                        height: lockedRect.height
                    }
                });
            }
        }

        // Create the new locked rectangle
        const newLockedRect = {
            x: minX,
            y: minY,
            width,
            height,
            area,
            numberCell
        };

        // Add to locked rectangles and update the game
        game.lockedRectangles.push(newLockedRect);
        game.isComplete = game.lockedRectangles.length === game.rectangles.length;
        game.updatedAt = new Date();
        
        if (game.isComplete) {
            // Create a grid to check coverage
            const grid = Array(game.rows).fill().map(() => Array(game.cols).fill(false));
            
            // Mark all cells covered by rectangles
            for (const rect of game.lockedRectangles) {
                for (let y = rect.y; y < rect.y + rect.height; y++) {
                    for (let x = rect.x; x < rect.x + rect.width; x++) {
                        if (grid[y][x]) {
                            // Overlapping rectangles
                            game.isWon = false;
                            break;
                        }
                        grid[y][x] = true;
                    }
                }
            }

            // Check if all cells are covered
            game.isWon = grid.every(row => row.every(cell => cell));
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
});

app.post('/api/unlock-rectangle', async (req, res) => {
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
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info('New client connected');

    socket.on('select-rectangle', async (data) => {
        const { boardId, x, y } = data;
        const game = await Game.findOne({ gameId: boardId });
        
        if (!game) {
            socket.emit('error', 'Board not found');
            return;
        }

        const rect = game.selectRectangle(x, y);
        socket.emit('rectangle-selected', rect);
    });

    socket.on('snap-rectangle', async (data) => {
        const { boardId, rectId, x, y } = data;
        const game = await Game.findOne({ gameId: boardId });
        
        if (!game) {
            socket.emit('error', 'Board not found');
            return;
        }

        if (game.snapRectangle(rectId, x, y)) {
            const isWin = game.checkWin();
            if (isWin) {
                game.isComplete = true;
                game.endTime = new Date();
                socket.emit('game-won', {
                    time: game.endTime - game.startTime
                });
            } else {
                socket.emit('rectangle-snapped', { rectId, x, y });
            }
        } else {
            socket.emit('error', 'Failed to snap rectangle');
        }
    });

    socket.on('disconnect', () => {
        logger.info('Client disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
}); 