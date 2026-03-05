
let appState = {
    step: 1,
    preferences: { budget: 500, cuisine: null, diet: 'Any', amenities: [] },
    user: JSON.parse(localStorage.getItem('user')) || null,
    userLocation: null,
    isSignup: false
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        initCursor();
        initTheme();
        initBudgetSlider();
        renderCuisineOptions();
        setupAuth();
        updateAuthUI();
        if (appState.user) loadUserHistory();
    } catch (e) { console.error(e); }
});

// --- UI & CURSOR ---
function initCursor() {
    const dot = document.querySelector('.cursor-dot');
    const outline = document.querySelector('.cursor-outline');
    let lastX = 0, lastY = 0;
    if (!dot || !outline) return;
    window.addEventListener('mousemove', (e) => {
        dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`;
        outline.animate({ left: `${e.clientX}px`, top: `${e.clientY}px` }, { duration: 500, fill: "forwards" });
        if (Math.hypot(e.clientX - lastX, e.clientY - lastY) > 50) {
            createEmojiTrail(e.clientX, e.clientY);
            lastX = e.clientX; lastY = e.clientY;
        }
    });
}

function createEmojiTrail(x, y) {
    const emojis = ['🍕', '🍔', '🍟', '🍩', '🥤', '🌮', '🍜', '🥗', '🍱'];
    const el = document.createElement('div');
    el.className = 'emoji-particle';
    el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    const angle = Math.random() * Math.PI * 2, vel = 30 + Math.random() * 50;
    el.style.setProperty('--tx', `${Math.cos(angle) * vel}px`);
    el.style.setProperty('--ty', `${Math.sin(angle) * vel}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 90}deg`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
}

function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    if (toggle) toggle.onclick = () => {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    };
}

// --- CORE APP LOGIC ---
function initBudgetSlider() {
    const slider = document.getElementById('budget-range');
    const display = document.getElementById('budget-display');
    if (!slider) return;
    slider.addEventListener('input', (e) => {
        appState.preferences.budget = parseInt(e.target.value);
        display.textContent = appState.preferences.budget >= 3000 ? "₹3000+" : `₹${appState.preferences.budget}`;
    });
}

function renderCuisineOptions() {
    const grid = document.getElementById('cuisine-grid');
    const cuisines = [
        { name: 'Indian', icon: 'fa-pepper-hot' }, { name: 'Chinese', icon: 'fa-utensils' },
        { name: 'Italian', icon: 'fa-pizza-slice' }, { name: 'American', icon: 'fa-hamburger' },
        { name: 'Japanese', icon: 'fa-fish' }
    ];
    if (!grid) return;
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
};

window.toggleFilterFacility = (fac) => {
    const idx = appState.preferences.amenities.indexOf(fac);
    if (idx > -1) appState.preferences.amenities.splice(idx, 1);
    else appState.preferences.amenities.push(fac);
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

// --- MAPPING & RESULTS ---
let currentResults = [];
window.showResults = async () => {
    const container = document.getElementById('results-container');
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    document.getElementById('results-page').classList.add('active');
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:5rem;"><i class="fas fa-circle-notch fa-spin" style="font-size:4rem; color:var(--primary);"></i><h3>Finding Nearest Spots...</h3></div>`;

    // 1. Get Location
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        appState.userLocation = { lat: uLat, lng: uLng };

        try {
            // 2. Fetch from Backend
            const response = await fetch('http://localhost:3000/api/recommend', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cuisine: appState.preferences.cuisine })
            });
            let data = await response.json();

            // 3. Client-side Sort by Distance
            data = data.map(r => ({
                ...r,
                distance: getDistanceFromLatLonInKm(uLat, uLng, r.lat, r.lng)
            })).sort((a, b) => a.distance - b.distance);

            currentResults = data;
            renderList(data);
        } catch (err) { container.innerHTML = `<h3>Server connection lost.</h3>`; }
    }, () => {
        container.innerHTML = `<div style="text-align:center; padding:5rem;"><i class="fas fa-map-marker-alt" style="font-size:4rem; opacity:0.3;"></i><h3>Please allow location access to see nearest restaurants.</h3></div>`;
    }, { enableHighAccuracy: true });
};

function renderList(list) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<h3 style="grid-column:1/-1; text-align:center;">No restaurants match your filters. Try widening your search!</h3>`;
        return;
    }

    list.forEach((r, idx) => {
        const isNearest = idx === 0;
        const div = document.createElement('div');
        div.className = 'premium-card';
        div.innerHTML = `
            <div class="card-image-wrap">
                <img src="${r.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500'}">
                <div class="card-overlay-badge">${r.rating} ★</div>
                ${isNearest ? '<div style="position:absolute; top:15px; left:15px; background:var(--success); color:white; padding:0.4rem 0.8rem; border-radius:30px; font-weight:700; font-size:0.8rem; z-index:10; box-shadow:0 4px 10px rgba(16,185,129,0.3);">NEAREST</div>' : ''}
            </div>
            <div class="card-content">
                <div class="card-title-row">
                    <h3>${r.name}</h3>
                    <span class="dist-tag">${r.distance.toFixed(1)} km</span>
                </div>
                <div class="card-meta">
                    <span>${r.cuisine} • ₹${r.budget} for two</span>
                </div>
                <div class="tag-row" style="margin-top:1rem;">
                    ${(r.facilities || []).slice(0, 3).map(f => `<span class="tag-sm">${f}</span>`).join('')}
                </div>
                <button class="view-btn-premium" onclick="openDetails(${r.id})">Exploure Menu & Map <i class="fas fa-chevron-right"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = (lat2 - lat1) * Math.PI / 180; var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- DETAILS & MAPS ---
let map;
window.openDetails = async (id) => {
    const r = currentResults.find(item => item.id == id);
    if (!r) return;

    if (appState.user) {
        fetch('http://localhost:3000/api/user/add_history', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: appState.user.email, item: { restaurantName: r.name, id: r.id, image: r.image, date: new Date().toLocaleDateString() } })
        });
    }

    const dishes = r.dishes || [
        { name: "Signature Special", price: 450, img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200" },
        { name: "Chef's Delight", price: 320, img: "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?w=200" }
    ];

    document.getElementById('details-body').innerHTML = `
        <div class="details-hero">
            <img src="${r.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000'}" class="details-hero-img">
            <div class="details-overlay-info">
                <h1 style="font-size:3rem; margin-bottom:0.5rem;">${r.name}</h1>
                <p><i class="fas fa-map-marker-alt"></i> Verified Spot • Highly Recommended</p>
            </div>
        </div>
        <div class="details-layout">
            <div class="details-menu">
                <h3 style="margin-bottom:1.5rem; font-family:var(--font-heading);">House Specialties</h3>
                <div class="dish-grid-modern">
                    ${dishes.map(d => `
                        <div class="dish-card-modern">
                            <img src="${d.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'}">
                            <div class="dish-details">
                                <h4>${d.name}</h4>
                                <span class="price">₹${d.price}</span>
                                <button class="btn-sm" onclick="alert('Ordering feature coming soon!')">Order Now</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="details-map-side">
                <h3 style="margin-bottom:1.5rem; font-family:var(--font-heading);">Live Map</h3>
                <div id="map" style="height: 280px; border-radius: 20px; border: 1px solid var(--border); margin-bottom: 1.5rem;"></div>
                <button class="btn-login" style="width:100%; padding:1.2rem; font-size:1.1rem;" onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${appState.userLocation.lat},${appState.userLocation.lng}&destination=${r.lat},${r.lng}')">
                    <i class="fas fa-directions"></i> Get Precision Directions
                </button>
            </div>
        </div>
    `;
    document.getElementById('details-modal').style.display = 'flex';

    setTimeout(() => {
        if (map) map.remove();
        map = L.map('map').setView([r.lat, r.lng], 16);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' }).addTo(map);

        // Add User Marker
        L.circleMarker([appState.userLocation.lat, appState.userLocation.lng], { color: 'var(--primary)', radius: 8 }).addTo(map).bindPopup("You are here");

        // Add restaurant Marker
        const resIcon = L.divIcon({ className: 'custom-div-icon', html: "<div style='background-color:var(--primary); width:30px; height:300px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.3);'></div>", iconSize: [30, 30], iconAnchor: [15, 15] });
        L.marker([r.lat, r.lng]).addTo(map).bindPopup(`<b>${r.name}</b>`).openPopup();
    }, 200);
};

// --- AUTH UI ---
function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const authModal = document.getElementById('login-modal');
    const authForm = document.getElementById('auth-form');
    const authToggle = document.getElementById('auth-toggle');

    if (loginBtn) loginBtn.onclick = () => { if (appState.user) { handleLogout(); } else { authModal.style.display = 'flex'; } };

    authToggle.onclick = (e) => {
        e.preventDefault();
        appState.isSignup = !appState.isSignup;
        document.getElementById('signup-fields').style.display = appState.isSignup ? 'block' : 'none';
        document.getElementById('auth-submit-btn').textContent = appState.isSignup ? 'Create Account' : 'Sign In';
        authToggle.textContent = appState.isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up";
    };

    authForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const name = document.getElementById('reg-name').value;
        const url = appState.isSignup ? '/api/auth/register' : '/api/auth/login';
        const body = appState.isSignup ? { email, password, name, role: 'user' } : { email, password };
        try {
            const res = await fetch(`http://localhost:3000${url}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                if (appState.isSignup) { alert("Welcome! Sign in to continue."); appState.isSignup = false; authToggle.click(); }
                else {
                    appState.user = data.user;
                    localStorage.setItem('user', JSON.stringify(data.user));
                    authModal.style.display = 'none';
                    updateAuthUI();
                    loadUserHistory();
                }
            } else { alert(data.message || "Authentication failed."); }
        } catch (err) { alert("Check server connection."); }
    };
    document.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
}

function updateAuthUI() {
    const loginBtn = document.getElementById('login-btn');
    if (appState.user) {
        loginBtn.textContent = `Logout (${appState.user.name})`;
        document.getElementById('user-history-section').style.display = 'block';
    } else {
        loginBtn.textContent = 'Login';
        document.getElementById('user-history-section').style.display = 'none';
    }
}

async function loadUserHistory() {
    if (!appState.user) return;
    const res = await fetch('http://localhost:3000/api/user/get_history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: appState.user.email })
    });
    const history = await res.json();
    const container = document.getElementById('history-container');
    container.innerHTML = history.length ? '' : '<p>Your journey with SAVOUR starts here.</p>';
    history.slice(0, 5).forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-card';
        div.innerHTML = `<img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}"> <div><strong>${item.restaurantName}</strong><br><small>${item.date}</small></div>`;
        container.appendChild(div);
    });
}

function handleLogout() { localStorage.removeItem('user'); window.location.reload(); }
window.closeDetails = () => { document.getElementById('details-modal').style.display = 'none'; };
window.hideResults = () => { document.getElementById('results-page').classList.remove('active'); document.getElementById('step-5').classList.add('active'); };
window.checkAdminCode = (e) => { if (prompt("Access Code Required:") === '1010') return true; alert("Unauthorized."); e.preventDefault(); return false; };