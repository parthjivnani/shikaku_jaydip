require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const winston = require('winston');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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

// In-memory game state storage
const gameStates = new Map();

// Add this after the gameStates Map
let currentGame = null;

// Game logic
class ShikakuGame {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.rectangles = [];
        this.startTime = new Date();
        this.endTime = null;
        this.isComplete = false;
    }

    generateRectangles() {
        const rectangles = [];
        let id = 0;
        let remainingCells = new Set();
        
        // Initialize available cells
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                remainingCells.add(`${x},${y}`);
            }
        }

        while (remainingCells.size > 0) {
            const [x, y] = this.getRandomCell(remainingCells);
            const maxWidth = Math.min(3, this.width - x);
            const maxHeight = Math.min(3, this.height - y);
            
            // Generate random dimensions
            const width = Math.floor(Math.random() * maxWidth) + 1;
            const height = Math.floor(Math.random() * maxHeight) + 1;
            
            // Create rectangle
            const rect = {
                id: `rect-${id++}`,
                x,
                y,
                width,
                height,
                area: width * height,
                locked: false
            };
            
            // Remove covered cells from available cells
            for (let dy = 0; dy < height; dy++) {
                for (let dx = 0; dx < width; dx++) {
                    remainingCells.delete(`${x + dx},${y + dy}`);
                }
            }
            
            rectangles.push(rect);
        }
        
        this.rectangles = rectangles;
        return rectangles;
    }

    getRandomCell(cells) {
        const index = Math.floor(Math.random() * cells.size);
        const cell = Array.from(cells)[index];
        cells.delete(cell);
        return cell.split(',').map(Number);
    }

    selectRectangle(x, y) {
        return this.rectangles.find(rect => {
            return x >= rect.x && x < rect.x + rect.width &&
                   y >= rect.y && y < rect.y + rect.height;
        });
    }

    snapRectangle(rectId, x, y) {
        const rect = this.rectangles.find(r => r.id === rectId);
        if (rect && !rect.locked) {
            rect.x = x;
            rect.y = y;
            rect.locked = true;
            return true;
        }
        return false;
    }

    checkWin() {
        // Check if all rectangles are locked and the board is fully covered
        const allLocked = this.rectangles.every(rect => rect.locked);
        if (!allLocked) return false;

        // Create a grid to check coverage
        const grid = Array(this.height).fill().map(() => Array(this.width).fill(false));
        
        for (const rect of this.rectangles) {
            for (let y = rect.y; y < rect.y + rect.height; y++) {
                for (let x = rect.x; x < rect.x + rect.width; x++) {
                    if (grid[y][x]) return false; // Overlapping rectangles
                    grid[y][x] = true;
                }
            }
        }

        // Check if all cells are covered
        return grid.every(row => row.every(cell => cell));
    }
}

// API Routes
app.post('/api/board', (req, res) => {
    const { width, height } = req.body;
    if (!width || !height || width < 1 || height < 1) {
        return res.status(400).json({ error: 'Invalid board dimensions' });
    }

    const game = new ShikakuGame(width, height);
    const boardId = Math.random().toString(36).substr(2, 9);
    gameStates.set(boardId, game);
    
    logger.info(`Created new board: ${boardId}`);
    res.json({ boardId, dimensions: { width, height } });
});

app.get('/api/rectangles', (req, res) => {
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

    // Store the current game state
    currentGame = {
        rows,
        cols,
        rectangles,
        grid
    };

    res.json({
        rows,
        cols,
        rectangles
    });
});

app.post('/api/lock-rectangle', (req, res) => {
    if (!currentGame) {
        return res.status(400).json({ error: 'No active game' });
    }

    const { start, end } = req.body;
    
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
    for (const rect of currentGame.rectangles) {
        if (rect.numberCell.x >= minX && rect.numberCell.x <= maxX &&
            rect.numberCell.y >= minY && rect.numberCell.y <= maxY) {
            if (numberCell) {
                // More than one number cell in the area
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

    // Check if the area overlaps with any locked rectangles
    for (const rect of currentGame.rectangles) {
        if (rect.locked) {
            const rectMinX = rect.x;
            const rectMaxX = rect.x + rect.width - 1;
            const rectMinY = rect.y;
            const rectMaxY = rect.y + rect.height - 1;

            if (!(maxX < rectMinX || minX > rectMaxX || maxY < rectMinY || minY > rectMaxY)) {
                return res.status(400).json({ error: 'Area overlaps with locked rectangle' });
            }
        }
    }

    // Lock the rectangle
    for (const rect of currentGame.rectangles) {
        if (rect.numberCell.x === numberCell.x && rect.numberCell.y === numberCell.y) {
            rect.locked = true;
            rect.x = minX;
            rect.y = minY;
            rect.width = width;
            rect.height = height;
            break;
        }
    }

    // Check if the game is complete
    const isComplete = currentGame.rectangles.every(rect => rect.locked);

    res.json({
        success: true,
        isComplete,
        rectangle: {
            x: minX,
            y: minY,
            width,
            height,
            area
        }
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info('New client connected');

    socket.on('select-rectangle', (data) => {
        const { boardId, x, y } = data;
        const game = gameStates.get(boardId);
        
        if (!game) {
            socket.emit('error', 'Board not found');
            return;
        }

        const rect = game.selectRectangle(x, y);
        socket.emit('rectangle-selected', rect);
    });

    socket.on('snap-rectangle', (data) => {
        const { boardId, rectId, x, y } = data;
        const game = gameStates.get(boardId);
        
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