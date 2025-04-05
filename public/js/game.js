class ShikakuGame {
    constructor() {
        this.socket = io();
        this.boardId = null;
        this.selectedRect = null;
        this.startTime = null;
        this.timerInterval = null;
        this.rectangles = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('newGame').addEventListener('click', () => {
            document.getElementById('setupModal').classList.add('active');
        });

        document.getElementById('startGame').addEventListener('click', () => {
            const width = parseInt(document.getElementById('boardWidth').value);
            const height = parseInt(document.getElementById('boardHeight').value);
            this.initializeBoard(width, height);
            document.getElementById('setupModal').classList.remove('active');
        });

        // Socket event listeners
        this.socket.on('rectangle-selected', (rect) => {
            if (rect) {
                this.selectRectangle(rect);
            }
        });

        this.socket.on('rectangle-snapped', ({ rectId, x, y }) => {
            this.updateRectanglePosition(rectId, x, y);
        });

        this.socket.on('game-won', ({ time }) => {
            this.handleGameWon(time);
        });

        this.socket.on('error', (message) => {
            this.showMessage(message, 'error');
        });

        // Add keyboard event listeners for moving rectangles
        document.addEventListener('keydown', (e) => {
            if (this.selectedRect) {
                let newX = this.selectedRect.x;
                let newY = this.selectedRect.y;

                switch (e.key) {
                    case 'ArrowLeft':
                        newX = Math.max(0, newX - 1);
                        break;
                    case 'ArrowRight':
                        newX = Math.min(this.boardWidth - this.selectedRect.width, newX + 1);
                        break;
                    case 'ArrowUp':
                        newY = Math.max(0, newY - 1);
                        break;
                    case 'ArrowDown':
                        newY = Math.min(this.boardHeight - this.selectedRect.height, newY + 1);
                        break;
                    case 'Enter':
                    case ' ':
                        this.socket.emit('snap-rectangle', {
                            boardId: this.boardId,
                            rectId: this.selectedRect.id,
                            x: newX,
                            y: newY
                        });
                        return;
                }

                this.updateRectanglePosition(this.selectedRect.id, newX, newY);
            }
        });
    }

    initializeBoard(width, height) {
        this.boardWidth = width;
        this.boardHeight = height;
        
        fetch('/api/board', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ width, height })
        })
        .then(response => response.json())
        .then(data => {
            this.boardId = data.boardId;
            this.createGameBoard(width, height);
            this.generateRectangles();
            this.startTimer();
        })
        .catch(error => {
            console.error('Error:', error);
            this.showMessage('Failed to initialize board', 'error');
        });
    }

    createGameBoard(width, height) {
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.style.gridTemplateColumns = `repeat(${width}, 60px)`;
        gameBoard.innerHTML = '';

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.addEventListener('click', () => this.handleCellClick(x, y));
                gameBoard.appendChild(cell);
            }
        }
    }

    generateRectangles() {
        fetch('/api/rectangles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ boardId: this.boardId })
        })
        .then(response => response.json())
        .then(data => {
            this.rectangles = data.rectangles;
            this.drawRectangles(data.rectangles);
        })
        .catch(error => {
            console.error('Error:', error);
            this.showMessage('Failed to generate rectangles', 'error');
        });
    }

    handleCellClick(x, y) {
        const rect = this.rectangles.find(r => 
            x >= r.x && x < r.x + r.width &&
            y >= r.y && y < r.y + r.height
        );

        if (rect && !rect.locked) {
            this.selectRectangle(rect);
        }
    }

    selectRectangle(rect) {
        if (this.selectedRect) {
            const prevRect = document.getElementById(this.selectedRect.id);
            if (prevRect) {
                prevRect.classList.remove('selected');
            }
        }
        
        this.selectedRect = rect;
        if (rect) {
            const rectElement = document.getElementById(rect.id);
            if (rectElement) {
                rectElement.classList.add('selected');
            }
        }
    }

    updateRectanglePosition(rectId, x, y) {
        const rect = document.getElementById(rectId);
        if (rect) {
            rect.style.transform = `translate(${x * 60}px, ${y * 60}px)`;
            
            // Update the rectangle's position in our local state
            const rectData = this.rectangles.find(r => r.id === rectId);
            if (rectData) {
                rectData.x = x;
                rectData.y = y;
            }
        }
    }

    drawRectangles(rectangles) {
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.querySelectorAll('.rectangle').forEach(el => el.remove());

        rectangles.forEach(rect => {
            const rectElement = document.createElement('div');
            rectElement.id = rect.id;
            rectElement.className = 'rectangle';
            rectElement.style.width = `${rect.width * 60 - 2}px`;
            rectElement.style.height = `${rect.height * 60 - 2}px`;
            rectElement.style.transform = `translate(${rect.x * 60}px, ${rect.y * 60}px)`;
            
            // Add the area number
            const areaText = document.createElement('div');
            areaText.className = 'area-number';
            areaText.textContent = rect.area;
            rectElement.appendChild(areaText);

            if (rect.locked) {
                rectElement.classList.add('locked');
            }

            rectElement.addEventListener('click', () => {
                if (!rect.locked) {
                    this.selectRectangle(rect);
                }
            });

            gameBoard.appendChild(rectElement);
        });
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.startTime = Date.now();
        this.updateTimer();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    }

    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('time').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    handleGameWon(time) {
        clearInterval(this.timerInterval);
        const seconds = Math.floor(time / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        this.showMessage(`Congratulations! You solved the puzzle in ${minutes}:${remainingSeconds.toString().padStart(2, '0')}!`, 'success');
    }

    showMessage(text, type = 'info') {
        const messageElement = document.getElementById('message');
        messageElement.textContent = text;
        messageElement.className = `message ${type}`;
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ShikakuGame();
}); 