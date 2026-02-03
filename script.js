// --- State Management ---
const appState = {
    step: 1,
    preferences: {
        budget: 500,
        cuisine: null,
        diet: 'Any',
        diningMode: 'Dine-in',
        minRating: 4.0,
        amenities: []
    },
    location: null,
    restaurants: []
};
// --- Mock Data Extension ---
const chefNames = ["Marco Rossi", "Anjali Menon", "Kenji Sato", "Sarah Jenkins", "Vikram Singh"];
const reviewTexts = [
    "Absolutely loved the ambiance! The food was top notch.",
    "Great service, but a bit pricey for the portion size.",
    "A hidden gem. The chef's special is a must-try!",
    "Perfect for family dinners. Very spacious.",
    "The flavors were authentic and the presentation was beautiful."
];
const menuItems = [
    { name: "Signature Pasta", price: "₹350", img: "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=200" },
    { name: "Spicy Curry", price: "₹420", img: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=200" },
    { name: "Cheese Platter", price: "₹550", img: "https://images.unsplash.com/photo-1541592618-3fa059c959f4?w=200" },
    { name: "Fusion Tacos", price: "₹290", img: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200" }
];
const famousDishes = [
    "Truffle Risotto", "Butter Chicken", "Dragon Roll", "Molten Lava Cake"
];
// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCursor(); // Custom Cursor Logic
    initBudgetSlider();
    loadRestaurants();
    renderCuisineOptions();
    // Login Modal Triggers
    const loginModal = document.getElementById('login-modal');
    document.getElementById('login-btn').addEventListener('click', () => {
        loginModal.style.display = 'flex';
    });
    document.querySelector('#login-modal .close-modal').addEventListener('click', () => {
        loginModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) loginModal.style.display = 'none';
        if (e.target === document.getElementById('details-modal')) closeDetails();
    });
});
// --- Custom Cursor Logic (Dot + Outline + Fruit Ninja Food Trail) ---
function initCursor() {
    const dot = document.querySelector('.cursor-dot');
    const outline = document.querySelector('.cursor-outline');
    // Safety check if elements exist
    if (!dot || !outline) return;
    // Track mouse distance for cleaner trail
    let lastX = 0;
    let lastY = 0;
    window.addEventListener('mousemove', (e) => {
        const posX = e.clientX;
        const posY = e.clientY;
        // Dot follows instantly
        dot.style.left = `${posX}px`;
        dot.style.top = `${posY}px`;
        // Outline follows with delay
        outline.animate({
            left: `${posX}px`,
            top: `${posY}px`
        }, { duration: 500, fill: "forwards" });
        // Spawn Food Trail (Distance Based)
        // Calculate distance moved
        const dist = Math.hypot(posX - lastX, posY - lastY);
        // Threshold: Only spawn every 50px moved (Declustered)
        if (dist > 50) {
            createEmojiTrail(posX, posY);
            lastX = posX;
            lastY = posY;
        }
    });
    // Hover Magnet triggers
    const interactive = document.querySelectorAll('a, button, .selection-card, input[type="range"], .toggle-btn, .restaurant-card');
    interactive.forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('hover-magnet'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('hover-magnet'));
    });
}
function createEmojiTrail(x, y) {
    const emojis = ['🍕', '🍔', '🍟', '🍩', '🥤', '🌮', '🍜', '🥗', '🍱'];
    const el = document.createElement('div');
    el.classList.add('emoji-particle');
    el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    // Position
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    // Improved Random Scatter
    const angle = Math.random() * Math.PI * 2;
    const velocity = 20 + Math.random() * 40; // Random speed
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;
    // Random interaction rotation
    const rot = (Math.random() - 0.5) * 60; // +/- 30deg tilt
    el.style.setProperty('--tx', `${tx}px`);
    el.style.setProperty('--ty', `${ty}px`);
    el.style.setProperty('--rot', `${rot}deg`);
    document.body.appendChild(el);
    // Faster cleanup (0.6s)
    setTimeout(() => {
        el.remove();
    }, 600);
}
// --- Navigation Flow ---
window.nextStep = (targetStep) => {
    if (targetStep === 3 && !appState.preferences.cuisine) {
        alert("Please pick a cuisine to proceed!");
        return;
    }
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    const targetEl = document.getElementById(`step-${targetStep}`);
    if (targetEl) {
        targetEl.classList.add('active');
        appState.step = targetStep;
    } else if (targetStep === 6) {
        showResults();
    }
};
window.showResults = () => {
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    document.getElementById('results-page').classList.add('active');
    calculateResults();
};
// --- Step Logic ---
function initBudgetSlider() {
    const slider = document.getElementById('budget-range');
    const display = document.getElementById('budget-display');
    slider.addEventListener('input', (e) => {
        appState.preferences.budget = parseInt(e.target.value);
        display.textContent = `₹${e.target.value}`;
    });
}
function renderCuisineOptions() {
    const cuisines = [
        { name: 'Indian', icon: 'fa-pepper-hot' },
        { name: 'Chinese', icon: 'fa-utensils' },
        { name: 'Italian', icon: 'fa-pizza-slice' },
        { name: 'Mexican', icon: 'fa-hat-cowboy' },
        { name: 'American', icon: 'fa-hamburger' },
        { name: 'Japanese', icon: 'fa-fish' },
        { name: 'Cafe', icon: 'fa-coffee' }
    ];
    const grid = document.getElementById('cuisine-grid');
    grid.innerHTML = '';
    cuisines.forEach(c => {
        const div = document.createElement('div');
        div.className = 'selection-card';
        div.innerHTML = `<i class="fas ${c.icon}"></i><h3>${c.name}</h3>`;
        div.onclick = () => {
            grid.querySelectorAll('.selection-card').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            appState.preferences.cuisine = c.name;
        };
        div.onmouseenter = () => document.body.classList.add('hover-magnet');
        div.onmouseleave = () => document.body.classList.remove('hover-magnet');
        grid.appendChild(div);
    });
}
window.selectDiet = (type, el) => {
    document.querySelectorAll('#step-3 .selection-card').forEach(card => card.classList.remove('selected'));
    el.classList.add('selected');
    appState.preferences.diet = type;
};
window.selectService = (mode, el) => {
    document.querySelectorAll('#step-4 .selection-card').forEach(card => card.classList.remove('selected'));
    el.classList.add('selected');
    appState.preferences.diningMode = mode;
};
window.updateAmenityRating = (val) => {
    appState.preferences.minRating = parseFloat(val);
    document.getElementById('amenity-rating-val').textContent = val;
};
window.toggleFilterFacility = (fac) => {
    const idx = appState.preferences.amenities.indexOf(fac);
    if (idx > -1) appState.preferences.amenities.splice(idx, 1);
    else appState.preferences.amenities.push(fac);
};
// --- Result Calculation ---
function calculateResults() {
    const { restaurants } = appState;
    const { cuisine, diet, budget, minRating, amenities } = appState.preferences;
    const scores = restaurants.map(r => {
        let score = 0;
        if (r.cuisine === cuisine) score += 50; else score -= 1000;
        if (diet === 'Veg' && !r.isVeg) return { ...r, score: -9999 };
        if (r.rating < minRating) return { ...r, score: -9999 };
        const diff = Math.abs((r.budget === 'Low' ? 300 : r.budget === 'Medium' ? 800 : 2000) - budget);
        if (diff < 300) score += 20;
        const matchCount = amenities.filter(a => r.facilities.includes(a)).length;
        score += (matchCount * 10);
        return { ...r, score };
    });
    const final = scores.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    renderResults(final);
}
function renderResults(list) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
                <i class="fas fa-search" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                <h3>No perfect match found.</h3>
                <p>Try adjusting your filters (especially Cuisine).</p>
            </div>
        `;
        return;
    }
    list.forEach(r => {
        const div = document.createElement('div');
        div.className = 'restaurant-card';
        div.innerHTML = `
            <div class="card-image-wrap">
                <img src="${r.image}" alt="${r.name}">
                <span class="card-rating">${r.rating} ★</span>
            </div>
            <div class="card-content">
                <h3 class="card-title">${r.name}</h3>
                <div class="card-meta">
                    <span>${r.cuisine} • ${r.budget}</span>
                    <span>${r.isVeg ? '<span style="color:var(--success)">Pure Veg</span>' : 'Veg/Non-Veg'}</span>
                </div>
                <div class="tag-row">
                    ${r.facilities.slice(0, 3).map(f => `<span class="tag">${f}</span>`).join('')}
                </div>
                <button class="view-btn" onclick="openDetails(${r.id})">View Details</button>
            </div>
        `;
        div.onmouseenter = () => document.body.classList.add('hover-magnet');
        div.onmouseleave = () => document.body.classList.remove('hover-magnet');
        container.appendChild(div);
    });
}
// --- Detailed View Logic ---
window.openDetails = (id) => {
    const r = appState.restaurants.find(item => item.id === id);
    if (!r) return;
    // Generate random data for demo
    const chef = chefNames[id % chefNames.length];
    const randReviews = [reviewTexts[id % reviewTexts.length], reviewTexts[(id + 1) % reviewTexts.length]];
    const famous = [famousDishes[id % famousDishes.length], famousDishes[(id + 1) % famousDishes.length]];
    const modalBody = document.getElementById('details-body');
    modalBody.innerHTML = `
        <div class="details-hero">
            <img src="${r.image}" alt="${r.name}">
            <div class="details-overlay">
                <h1 style="font-size:2.5rem; font-family:var(--font-heading);">${r.name}</h1>
                <p style="opacity:0.9; margin-bottom:0.5rem;">${r.cuisine} | ${r.budget} | ${r.coords.lat.toFixed(2)}, ${r.coords.lng.toFixed(2)}</p>
                <div class="tag-row">
                    ${r.facilities.map(f => `<span class="tag" style="background:rgba(255,255,255,0.2); color:white;">${f}</span>`).join('')}
                </div>
            </div>
        </div>
        
        <div class="details-header">
            <div style="display:flex; gap:1rem; margin-bottom:1.5rem;">
                <button class="btn-primary-glow" style="padding:0.8rem 2rem; border-radius:12px; border:none; color:white; font-weight:600; cursor:pointer;">Book a Table</button>
                <button style="padding:0.8rem 2rem; border-radius:12px; border:2px solid var(--border); background:transparent; font-weight:600; cursor:pointer;" onclick="alert('Navigating...')">Navigate</button>
            </div>
        </div>
        <div class="details-grid">
            <div class="left-col">
                <h3 style="margin-bottom:1rem;">Famous Dishes</h3>
                <p style="margin-bottom:2rem; color:var(--text-muted);">${famous.join(', ')}, and more.</p>
                <h3 style="margin-bottom:1rem;">Menu Highlights</h3>
                <div class="menu-grid">
                    ${menuItems.map(m => `
                        <div class="menu-item">
                            <img src="${m.img}" class="menu-img">
                            <p class="menu-name">${m.name}</p>
                            <span class="menu-price">${m.price}</span>
                        </div>
                    `).join('')}
                </div>
                
                <h3 style="margin-top:2rem; margin-bottom:1rem;">About the Chef</h3>
                <div class="chef-section">
                    <img src="https://i.pravatar.cc/150?u=${id}" class="chef-avatar" alt="Chef">
                    <div>
                        <h4 style="margin:0;">Chef ${chef}</h4>
                        <p style="font-size:0.9rem; color:var(--text-muted);">Executive Chef • 12 Years Exp</p>
                    </div>
                </div>
            </div>
            <div class="right-col">
                <h3 style="margin-bottom:1rem;">Guest Reviews</h3>
                <div class="reviews-scroll">
                    ${randReviews.map(txt => `
                        <div class="review-item">
                            <div class="review-header">
                                <span>Guest ${(Math.random() * 1000).toFixed(0)}</span>
                                <span style="color:#fbbf24;">★★★★★</span>
                            </div>
                            <p class="review-text">"${txt}"</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    document.getElementById('details-modal').style.display = 'flex';
};
window.closeDetails = () => {
    document.getElementById('details-modal').style.display = 'none';
};
// --- Theme ---
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
    document.getElementById('theme-toggle').onclick = toggleTheme;
}
function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}
function updateThemeIcon(t) {
    const icon = document.querySelector('#theme-toggle i');
    icon.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    icon.style.color = t === 'dark' ? '#FBBF24' : '#1F2933';
}
// --- Data (Inlined) ---
function loadRestaurants() {
    appState.restaurants = [
        { "id": 1, "name": "Spicy Villa", "cuisine": "Indian", "budget": "Medium", "rating": 4.5, "facilities": ["AC", "Parking", "Wi-Fi"], "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9716, "lng": 77.5946 }, "isVeg": false },
        { "id": 2, "name": "Burger Barn", "cuisine": "American", "budget": "Low", "rating": 4.0, "facilities": ["AC", "Parking"], "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9780, "lng": 77.6000 }, "isVeg": false },
        { "id": 3, "name": "Sushi World", "cuisine": "Japanese", "budget": "High", "rating": 4.8, "facilities": ["AC", "Parking", "Private Dining"], "image": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9600, "lng": 77.5800 }, "isVeg": false },
        { "id": 4, "name": "Pasta Point", "cuisine": "Italian", "budget": "Medium", "rating": 4.2, "facilities": ["AC", "Wi-Fi"], "image": "https://images.unsplash.com/photo-1481931098730-318b6f776db0?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9850, "lng": 77.5900 }, "isVeg": true },
        { "id": 5, "name": "Taco Fiesta", "cuisine": "Mexican", "budget": "Low", "rating": 4.3, "facilities": ["Outdoor Seating"], "image": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9700, "lng": 77.6100 }, "isVeg": false },
        { "id": 6, "name": "The Golden Dragon", "cuisine": "Chinese", "budget": "Medium", "rating": 4.1, "facilities": ["AC", "Parking", "Banquet"], "image": "https://images.unsplash.com/photo-1525164286253-04e68b9d94c6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9550, "lng": 77.5950 }, "isVeg": false },
        { "id": 7, "name": "Cafe Mocha", "cuisine": "Cafe", "budget": "Low", "rating": 4.6, "facilities": ["Wi-Fi", "AC", "Books"], "image": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9650, "lng": 77.5850 }, "isVeg": true },
        { "id": 8, "name": "Royal Feast", "cuisine": "Indian", "budget": "High", "rating": 4.9, "facilities": ["AC", "Parking", "Valet", "Live Music"], "image": "https://images.unsplash.com/photo-1585937421612-70a008356f36?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9900, "lng": 77.6200 }, "isVeg": false },
        { "id": 9, "name": "Green Greens", "cuisine": "Continental", "budget": "Medium", "rating": 4.4, "facilities": ["Wi-Fi", "Outdoor Seating"], "image": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9750, "lng": 77.5900 }, "isVeg": true },
        { "id": 10, "name": "Mediterranean Mind", "cuisine": "Mediterranean", "budget": "High", "rating": 4.7, "facilities": ["AC", "Parking", "Rooftop"], "image": "https://images.unsplash.com/photo-1544148103-0773bf10d330?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", "coords": { "lat": 12.9600, "lng": 77.6050 }, "isVeg": false }
    ];
}