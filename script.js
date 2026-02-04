document.addEventListener('DOMContentLoaded', () => {
    try {
        initCursor();
        initTheme();
        initBudgetSlider();
        renderCuisineOptions();
        setupLoginModals();
    } catch (e) { console.error(e); }
});
function initCursor() {
    const dot = document.querySelector('.cursor-dot');
    const outline = document.querySelector('.cursor-outline');
    let lastX = 0, lastY = 0;
    if (!dot || !outline) return;
    window.addEventListener('mousemove', (e) => {
        dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`;
        outline.animate({ left: `${e.clientX}px`, top: `${e.clientY}px` }, { duration: 500, fill: "forwards" });
        if (Math.hypot(e.clientX - lastX, e.clientY - lastY) > 40) {
            createEmojiTrail(e.clientX, e.clientY);
            lastX = e.clientX; lastY = e.clientY;
        }
    });
}
function createEmojiTrail(x, y) {
    const emojis = ['🍕', '🍔', '🍟', '🍩', '🥤', '🌮', '🍜', '🥗', '🍱', '🥥', '🍤'];
    const el = document.createElement('div');
    el.classList.add('emoji-particle');
    el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    const angle = Math.random() * Math.PI * 2, velocity = 20 + Math.random() * 40;
    el.style.setProperty('--tx', `${Math.cos(angle) * velocity}px`);
    el.style.setProperty('--ty', `${Math.sin(angle) * velocity}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 60}deg`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
}
function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    toggle.onclick = () => {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    };
}
function setupLoginModals() {
    const loginBtn = document.getElementById('login-btn');
    const loginModal = document.getElementById('login-modal');
    if (loginBtn && loginModal) {
        loginBtn.onclick = () => loginModal.style.display = 'flex';
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = function () { this.closest('.modal').style.display = 'none'; }
        });
    }
}
const mockRestaurants = [
    {
        id: "m1", name: "Spice Villa", cuisine: "Indian", budget: 800, rating: 4.5,
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
        vicinity: "MG Road, Center", facilities: ["AC", "Parking", "Wi-Fi"], isVeg: false,
        lat: 9.9312, lng: 76.2673,
        dishes: [
            { name: "Butter Chicken", price: 350, img: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=200" },
            { name: "Garlic Naan", price: 80, img: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=200" },
            { name: "Biryani", price: 250, img: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=200" }
        ]
    },
    {
        id: "m2", name: "Pizza Haven", cuisine: "Italian", budget: 600, rating: 4.2,
        image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800",
        vicinity: "Marine Drive", facilities: ["AC", "Wi-Fi"], isVeg: false,
        lat: 9.9400, lng: 76.2700,
        dishes: [
            { name: "Margherita", price: 400, img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=200" },
            { name: "Pasta Alfredo", price: 300, img: "https://images.unsplash.com/photo-1626844131082-256783844137?w=200" }
        ]
    },
    {
        id: "m3", name: "Pure Greens", cuisine: "Indian", budget: 300, rating: 4.0,
        image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
        vicinity: "Kaloor", facilities: ["Parking"], isVeg: true,
        lat: 9.9500, lng: 76.2800,
        dishes: [{ name: "Veg Thali", price: 150, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200" }]
    },
    {
        id: "m4", name: "Tokyo Sushi", cuisine: "Japanese", budget: 2000, rating: 4.8,
        image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
        vicinity: "Edappally", facilities: ["AC", "Parking", "Wi-Fi"], isVeg: false,
        lat: 9.9600, lng: 76.2900,
        dishes: [{ name: "Sashimi Platter", price: 900, img: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200" }]
    },
    {
        id: "m5", name: "Dragon Wok", cuisine: "Chinese", budget: 500, rating: 4.1,
        image: "https://images.unsplash.com/photo-1525164286253-04e68b9d94c6?w=800",
        vicinity: "Vyttila", facilities: ["AC"], isVeg: false,
        lat: 9.9700, lng: 76.3000,
        dishes: [{ name: "Kung Pao", price: 320, img: "https://images.unsplash.com/photo-1525164286253-04e68b9d94c6?w=200" }]
    },
    {
        id: "m6", name: "Cafe Mocha", cuisine: "Cafe", budget: 400, rating: 4.4,
        image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800",
        vicinity: "Panampilly Nagar", facilities: ["Wi-Fi", "AC"], isVeg: false,
        lat: 9.9200, lng: 76.2800,
        dishes: [{ name: "Latte Art", price: 200, img: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200" }]
    },
    {
        id: "m7", name: "Taco Bell", cuisine: "Mexican", budget: 350, rating: 3.9,
        image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800",
        vicinity: "Lulu Mall", facilities: ["Parking"], isVeg: false,
        lat: 9.9800, lng: 76.3100,
        dishes: [{ name: "Tacos", price: 100, img: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200" }]
    },
    {
        id: "m8", name: "Burger King", cuisine: "American", budget: 450, rating: 4.0,
        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
        vicinity: "MG Road", facilities: ["AC"], isVeg: false,
        lat: 9.9350, lng: 76.2750,
        dishes: [{ name: "Whopper", price: 250, img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200" }]
    }
];
const appState = { step: 1, preferences: { budget: 500, cuisine: null, diet: 'Any', amenities: [] }, userLocation: null };
function initBudgetSlider() {
    const slider = document.getElementById('budget-range');
    const display = document.getElementById('budget-display');
    if (!slider) return;
    slider.min = 100; slider.max = 3000; slider.value = 500;
    slider.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        appState.preferences.budget = val;
        display.textContent = val >= 3000 ? "₹3000+" : `₹${val}`;
    });
}
function renderCuisineOptions() {
    const grid = document.getElementById('cuisine-grid');
    if (!grid) return;
    const cuisines = [
        { name: 'Indian', icon: 'fa-pepper-hot' }, { name: 'Chinese', icon: 'fa-utensils' },
        { name: 'Italian', icon: 'fa-pizza-slice' }, { name: 'Mexican', icon: 'fa-hat-cowboy' },
        { name: 'American', icon: 'fa-hamburger' }, { name: 'Japanese', icon: 'fa-fish' },
        { name: 'Cafe', icon: 'fa-coffee' }
    ];
    grid.innerHTML = '';
    cuisines.forEach(c => {
        const div = document.createElement('div');
        div.className = 'selection-card';
        div.innerHTML = `<i class="fas ${c.icon}"></i><h3>${c.name}</h3>`;
        div.onclick = () => {
            document.querySelectorAll('#step-2 .selection-card').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            appState.preferences.cuisine = c.name;
        };
        grid.appendChild(div);
    });
}
window.nextStep = (target) => {
    if (target === 3 && !appState.preferences.cuisine) { alert("Please pick a cuisine!"); return; }
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${target}`).classList.add('active');
    appState.step = target;
};
window.selectDiet = (val, el) => {
    document.querySelectorAll('#step-3 .selection-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    appState.preferences.diet = val;
};
window.selectService = (val, el) => {
    document.querySelectorAll('#step-4 .selection-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
};
window.toggleFilterFacility = (fac) => {
    const idx = appState.preferences.amenities.indexOf(fac);
    if (idx > -1) appState.preferences.amenities.splice(idx, 1);
    else appState.preferences.amenities.push(fac);
};
window.showResults = () => {
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    document.getElementById('results-page').classList.add('active');
    const container = document.getElementById('results-container');
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fas fa-search-location fa-spin" style="font-size:3rem; color:var(--primary);"></i><h3>Locating...</h3></div>`;
    if (!navigator.geolocation) { setTimeout(() => processMockResults(9.9312, 76.2673), 1000); return; }
    navigator.geolocation.getCurrentPosition(
        (pos) => processMockResults(pos.coords.latitude, pos.coords.longitude),
        (err) => { alert("Using default location."); processMockResults(9.9312, 76.2673); },
        { enableHighAccuracy: true, timeout: 5000 }
    );
};
window.hideResults = () => {
    document.getElementById('results-page').classList.remove('active');
    document.getElementById('step-5').classList.add('active');
};
function processMockResults(userLat, userLng) {
    const filters = appState.preferences;
    let results = mockRestaurants.map(r => {
        const dist = getDistanceFromLatLonInKm(userLat, userLng, r.lat, r.lng);
        return { ...r, distance: dist.toFixed(1) };
    });
    results = results.filter(r => {
        if (filters.cuisine && r.cuisine !== filters.cuisine) return false;
        if (Math.abs(r.budget - filters.budget) > 2000) return false;
        return true;
    });
    if (results.length === 0) {
        alert("No exact matches found. Showing all nearby options!");
        results = mockRestaurants.map(r => {
            const dist = getDistanceFromLatLonInKm(userLat, userLng, r.lat, r.lng);
            return { ...r, distance: dist.toFixed(1) };
        });
    }
    results.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    renderList(results);
}
function renderList(list) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
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
                    <span>${r.cuisine} • ₹${r.budget} for two</span>
                    <span style="color:var(--primary); font-weight:bold;">${r.distance} km</span>
                </div>
                <div class="tag-row">${r.facilities.map(f => `<span class="tag">${f}</span>`).join('')}</div>
                <button class="view-btn" onclick="openDetails('${r.id}')">View Details</button>
            </div>
        `;
        container.appendChild(div);
    });
}
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = deg2rad(lat2 - lat1); var dLon = deg2rad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
}
function deg2rad(deg) { return deg * (Math.PI / 180); }
window.openDetails = (id) => {
    const r = mockRestaurants.find(item => item.id === id);
    if (!r) return;
    const reviews = [
        "Amazing food! The flavors were authentic.",
        "Great ambiance but slightly slow service.",
        "Loved it! Will definitely come back."
    ];
    document.getElementById('details-body').innerHTML = `
        <img src="${r.image}" class="details-hero-img">
        <div class="details-overlay-info">
            <div>
                <h1 style="font-family:var(--font-heading); line-height:1;">${r.name}</h1>
                <p style="color:var(--text-muted);">${r.vicinity} | ${r.cuisine} | ₹${r.budget}</p>
            </div>
            <div style="font-size:1.5rem; font-weight:bold; color:var(--primary);">${r.rating} ★</div>
        </div>
        <div class="action-row">
            <button class="action-btn btn-book" onclick="alert('Table Booked!')">Book a Table</button>
            <button class="action-btn btn-nav" onclick="alert('Opening Google Maps...')">Navigate</button>
        </div>
        <div class="details-split">
            <div class="left-col">
                <h3 style="margin-bottom:1rem;">Famous Dishes</h3>
                <div class="dish-grid">
                    ${r.dishes.map(d => `
                        <div class="dish-item">
                            <img src="${d.img}" class="dish-img">
                            <div style="font-size:0.9rem; font-weight:600;">${d.name}</div>
                            <div style="font-size:0.8rem; color:var(--primary);">₹${d.price}</div>
                        </div>
                    `).join('')}
                </div>
                <h3 style="margin-bottom:1rem;">Meet the Chef</h3>
                <div class="chef-card">
                    <img src="https://i.pravatar.cc/150?u=${r.id}" class="chef-img">
                    <div>
                        <h4 style="margin:0;">Chef Antonio</h4>
                        <p style="font-size:0.8rem; color:var(--text-muted);">Executive Chef • 15 Years Exp</p>
                    </div>
                </div>
            </div>
            <div class="right-col">
                <h3 style="margin-bottom:1rem;">Customer Reviews</h3>
                ${reviews.map(txt => `
                    <div class="review-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <strong>User ${Math.floor(Math.random() * 100)}</strong>
                            <span style="color:#fbbf24;">★★★★★</span>
                        </div>
                        <p style="font-size:0.9rem; color:var(--text-muted);">"${txt}"</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.getElementById('details-modal').style.display = 'flex';
};
window.closeDetails = () => {
    document.getElementById('details-modal').style.display = 'none';
};