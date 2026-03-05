// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'restaurants.json');

app.use(cors());
app.use(express.json());

// Serve the frontend static files
app.use(express.static(__dirname));

app.post('/api/recommend', (req, res) => {
    try {
        const { lat, lng, cuisine } = req.body;

        // Read the local mock database
        let results = [];
        if (fs.existsSync(DB_FILE)) {
            const rawData = fs.readFileSync(DB_FILE, 'utf8');
            results = JSON.parse(rawData);
        }

        // Filter by cuisine if provided (and not "Any")
        if (cuisine && cuisine !== 'Any') {
            results = results.filter(r => r.cuisine && r.cuisine.toLowerCase() === cuisine.toLowerCase());
        }

        // Map coords down to top level so frontend works smoothly
        const mappedResults = results.map(r => ({
            ...r,
            lat: r.coords?.lat || r.lat,
            lng: r.coords?.lng || r.lng,
            // Fallbacks for frontend expectations
            budget: r.budget || 'Medium',
            facilities: r.facilities || []
        }));

        res.json(mappedResults);
    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));