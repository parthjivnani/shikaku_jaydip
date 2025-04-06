const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const winston = require('winston');
const path = require('path');
const gameRoutes = require('./routes/gameRoutes');

const app = express();
const port = process.env.PORT || 3010;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

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

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/shikaku', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    logger.info('Connected to MongoDB');
}).catch((error) => {
    logger.error('MongoDB connection error:', error);
});

// Routes
app.use('/api', gameRoutes);

// Serve the game page
app.get('/', (req, res) => {
    res.render('game');
});

// Start server
app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
}); 