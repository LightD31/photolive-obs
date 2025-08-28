// Simple test script to verify the timer progress bar
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3002;

// Serve static files
app.use(express.static('public'));

// Simple test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Timer test server running' });
});

app.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/control.html to test timer progress bar`);
});
