# Shikaku Puzzle Game

A web-based implementation of the Shikaku puzzle game using Node.js, Express, Socket.IO, and MongoDB.

## Features

- Real-time multiplayer support using Socket.IO
- Puzzle board generation with random rectangles
- Game state management
- Time tracking
- MongoDB database integration
- Logging system

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a .env file with the following variables:
   ```
   MONGODB_URI=your_mongodb_uri
   PORT=3000
   ```
4. Start the server:
   ```bash
   npm start
   ```

## API Endpoints

- `POST /api/board` - Initialize a new puzzle board
- `POST /api/rectangles` - Generate rectangles for the board
- `POST /api/select` - Handle player rectangle selection
- `POST /api/snap` - Snap and lock a rectangle in place
- `GET /api/check-win` - Check if the puzzle is solved
- `POST /api/reset` - Reset the game board
- `GET /api/time` - Get elapsed time

## Frontend

The game interface is built using HTML and EJS templates, with real-time updates through Socket.IO. 