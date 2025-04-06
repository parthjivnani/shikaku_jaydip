const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateGameId = () => Math.random().toString(36).substr(2, 9);

const generateRectangles = (rows, cols) => {
    const grid = Array.from({ length: rows }, () => Array(cols).fill(false));
    const rectangles = [];
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

    return rectangles;
};

const checkRectangleOverlap = (rect1, rect2) => {
    const rect1MaxX = rect1.x + rect1.width - 1;
    const rect1MaxY = rect1.y + rect1.height - 1;
    const rect2MaxX = rect2.x + rect2.width - 1;
    const rect2MaxY = rect2.y + rect2.height - 1;

    return !(rect1MaxX < rect2.x || rect1.x > rect2MaxX || rect1MaxY < rect2.y || rect1.y > rect2MaxY);
};

const checkGameCompletion = (game) => {
    // Create a grid to check coverage
    const grid = Array(game.rows).fill().map(() => Array(game.cols).fill(false));
    
    // Mark all cells covered by rectangles
    for (const rect of game.lockedRectangles) {
        for (let y = rect.y; y < rect.y + rect.height; y++) {
            for (let x = rect.x; x < rect.x + rect.width; x++) {
                if (grid[y][x]) {
                    // Overlapping rectangles
                    return { isComplete: true, isWon: false };
                }
                grid[y][x] = true;
            }
        }
    }

    // Check if all cells are covered
    const isWon = grid.every(row => row.every(cell => cell));
    return { isComplete: true, isWon };
};

module.exports = {
    getRandomInt,
    generateGameId,
    generateRectangles,
    checkRectangleOverlap,
    checkGameCompletion
}; 