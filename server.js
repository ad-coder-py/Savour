const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const https = require('https');
const app = express();
const PORT = 3000;
// REPLACE WITH YOUR ACTUAL KEY OR USE process.env.GOOGLE_API_KEY
const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY_HERE";
app.use(cors());
app.use(bodyParser.json());
// Load database
const DB_FILE = './database.json';
let dbData = {};
if (fs.existsSync(DB_FILE)) {
    dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
    // Seed with empty object if not exists
    dbData = {};
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData));
}
// Save DB helper
const saveDB = () => {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
};
// --- API: Recommend ---
app.post('/api/recommend', (req, res) => {
    const { lat, lng, budget, cuisine, amenities } = req.body;
    // 1. Fetch from Google Places API
    const radius = 5000; // 5km radius
    const keyword = cuisine || 'restaurant';
    const type = 'restaurant';
    // Note: In production, use axios or node-fetch. Using native https to avoid npm install steps if possible, 
    // but user likely needs 'npm install express cors body-parser'.
    // We will assume environment allows running this.
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&keyword=${keyword}&key=${GOOGLE_API_KEY}`;
    https.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => data += chunk);
        apiRes.on('end', () => {
            try {
                const json = JSON.parse(data);
                const results = json.results || [];
                // 2. Cross-reference and Filter with Local DB
                const enrichedResults = results.map(place => {
                    const localData = dbData[place.place_id];
                    // If logic: Return only if exists in DB? Or return all? 
                    // Prompt says: "Return a JSON array of restaurants that exist in BOTH Google and the local DB."
                    if (localData) {
                        return {
                            ...place,
                            ...localData, // Merge local amenities, verified budget, etc.
                            score: calculateScore(localData, { budget, amenities })
                        };
                    }
                    return null;
                }).filter(item => item !== null);
                // Sort by score
                enrichedResults.sort((a, b) => b.score - a.score);
                res.json(enrichedResults);
            } catch (e) {
                console.error("API Parse Error", e);
                res.status(500).json({ error: "Failed to parse Google API response" });
            }
        });
    }).on('error', (e) => {
        console.error("API Request Error", e);
        res.status(500).json({ error: "Failed to fetch from Google API" });
    });
});
// Scoring Helper
function calculateScore(restaurant, preferences) {
    let score = 0;
    const { budget, amenities } = preferences;
    // Budget diff logic (Simple)
    // restaurant.budget is stored as "Low" (300), "Medium" (800), "High" (2000)
    const budgetMap = { "Low": 300, "Medium": 800, "High": 2000 };
    const rBudgetVal = budgetMap[restaurant.budget] || 800;
    const diff = Math.abs(rBudgetVal - budget);
    if (diff < 300) score += 20;
    // Amenities match
    if (restaurant.facilities && amenities) {
        const matchCount = amenities.filter(a => restaurant.facilities.includes(a)).length;
        score += (matchCount * 10);
    }
    return score;
}
// --- API: Owner Register ---
app.post('/api/owner/register', (req, res) => {
    const { placeId, name, budget, facilities, cuisine, isVeg } = req.body;
    if (!placeId) return res.status(400).json({ error: "Place ID required" });
    // Save to DB
    dbData[placeId] = {
        id: placeId, // Use place_id as ID
        name,
        budget,
        facilities, // amenities
        cuisine,
        isVeg
    };
    saveDB();
    res.json({ success: true, message: "Restaurant Registered Successfully" });
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});