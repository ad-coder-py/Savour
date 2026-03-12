
let appState = {
    step: 1,
    preferences: { budget: 500, cuisine: null, diet: 'Any', amenities: [] },
    user: JSON.parse(localStorage.getItem('user')) || null,
    userLocation: null,
    isSignup: false,
    emailVerified: false
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

            // 3. Client-side Sort by Distance (Strictly under 10km prioritized)
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
        const isNearest = idx === 0 && r.distance < 10;
        const div = document.createElement('div');
        div.className = 'premium-card';
        div.innerHTML = `
            <div class="card-image-wrap">
                <img src="${r.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500'}">
                <div class="card-overlay-badge">${r.rating} ★</div>
                ${isNearest ? '<div class="nearest-badge">NEAREST TO YOU</div>' : ''}
            </div>
            <div class="card-content">
                <div class="card-title-row">
                    <h3>${r.name}</h3>
                    <span class="dist-tag">${r.distance.toFixed(1)} km</span>
                </div>
                <div class="card-meta">
                    <span>${r.cuisine} • Budget: ${r.budget}</span>
                </div>
                <div class="tag-row" style="margin-top:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
                    ${(r.facilities || []).slice(0, 3).map(f => `<span class="tag-sm" style="font-size:0.75rem; background:var(--background); padding:0.3rem 0.6rem; border-radius:6px; border:1px solid var(--border);">${f}</span>`).join('')}
                </div>
                <button class="view-btn-premium" onclick="openDetails(${r.id})">Explore Menu & Map <i class="fas fa-chevron-right"></i></button>
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
                <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <h1 style="font-size:3.5rem; margin-bottom:0.5rem; font-family:var(--font-heading); line-height:1;">${r.name}</h1>
                        <p style="font-size:1.1rem; opacity:0.9;"><i class="fas fa-map-marker-alt"></i> ${r.cuisine} • ${r.distance < 1 ? (r.distance*1000).toFixed(0) + ' m' : r.distance.toFixed(1) + ' km'} away</p>
                    </div>
                    <div style="background:rgba(255,255,255,0.2); backdrop-filter:blur(10px); padding:0.8rem 1.5rem; border-radius:16px; border:1px solid rgba(255,255,255,0.3);">
                        <div style="font-size:0.8rem; text-transform:uppercase; font-weight:700; opacity:0.8;">Avg. Rating</div>
                        <div style="font-size:1.8rem; font-weight:800;">${r.rating} <span style="font-size:1.2rem; color:var(--secondary);">★</span></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="details-layout">
            <div class="details-menu">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                    <h3 style="font-family:var(--font-heading); font-size:2rem;">House Specialties</h3>
                    <span class="tag-sm" style="background:var(--primary); color:white; border:none; padding:0.4rem 1rem;">Full Menu</span>
                </div>
                <div class="dish-grid-modern">
                    ${dishes.map(d => `
                        <div class="dish-card-modern">
                            <img src="${d.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'}">
                            <div class="dish-details">
                                <h4 style="font-size:1.2rem; margin-bottom:0.2rem;">${d.name}</h4>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span class="price" style="font-size:1.3rem;">₹${d.price}</span>
                                    <button class="btn-icon" style="color:var(--primary);" onclick="alert('Added to wishlist!')"><i class="far fa-heart"></i></button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top:3rem; padding:2rem; background:rgba(var(--primary-rgb), 0.03); border-radius:24px; border:2px dashed var(--border);">
                    <h4 style="margin-bottom:0.5rem;"><i class="fas fa-info-circle"></i> Good to know</h4>
                    <p style="color:var(--text-muted); font-size:0.95rem;">Prices are indicative and may vary. Special requests can be made during booking if available.</p>
                </div>
            </div>
            <div class="details-map-side">
                <div class="premium-glass" style="padding:2rem; border-radius:28px; box-shadow:var(--shadow-lg); border:1px solid var(--border);">
                    <h3 style="margin-bottom:1.5rem; font-family:var(--font-heading);">Location & Route</h3>
                    <div id="map" style="height: 350px; border-radius: 20px; border: 1px solid var(--border); margin-bottom: 2rem; z-index:1;"></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                         <div style="background:var(--background); padding:1rem; border-radius:16px; text-align:center;">
                            <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted);">Distance</div>
                            <div style="font-weight:700;">${r.distance.toFixed(1)} km</div>
                         </div>
                         <div style="background:var(--background); padding:1rem; border-radius:16px; text-align:center;">
                            <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted);">Est. Time</div>
                            <div style="font-weight:700;">${Math.ceil(r.distance * 3)} mins</div>
                         </div>
                    </div>
                    <button class="btn-login" style="width:100%; padding:1.2rem; font-size:1.1rem; border-radius:18px; display:flex; align-items:center; justify-content:center; gap:0.8rem;" onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${appState.userLocation.lat},${appState.userLocation.lng}&destination=${r.lat},${r.lng}')">
                        <i class="fas fa-location-arrow"></i> Get Directions
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('details-modal').style.display = 'flex';

    setTimeout(() => {
        if (map) map.remove();
        map = L.map('map').setView([r.lat, r.lng], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' }).addTo(map);

        const uLat = appState.userLocation.lat;
        const uLng = appState.userLocation.lng;

        // User Pulse Marker
        const pulseIcon = L.divIcon({
            className: '',
            html: `<div style="position:relative; width:16px; height:16px;"><div style="background:var(--primary); width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 0 rgba(255,107,53,0.6); animation: pulse-ring 1.5s infinite;"></div></div>`,
            iconSize: [20, 20], iconAnchor: [10, 10]
        });
        L.marker([uLat, uLng], { icon: pulseIcon }).addTo(map).bindPopup("You are here");

        // Restaurant Pin
        const resIcon = L.divIcon({
            className: '',
            html: `<div style="background:white; border:3px solid var(--primary); border-radius:50% 50% 50% 0; width:28px; height:28px; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.2);"><span style="transform:rotate(45deg); font-size:12px;">🍽️</span></div>`,
            iconSize: [28, 28], iconAnchor: [14, 28]
        });
        L.marker([r.lat, r.lng], { icon: resIcon }).addTo(map).bindPopup(`<b>${r.name}</b>`).openPopup();

        // Direction line
        L.polyline([[uLat, uLng], [r.lat, r.lng]], { color: 'var(--primary)', weight: 3, dashArray: '10, 10', opacity: 0.7 }).addTo(map);
        map.fitBounds([[uLat, uLng], [r.lat, r.lng]], { padding: [40, 40] });
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
        appState.emailVerified = false;
        document.getElementById('signup-fields').style.display = appState.isSignup ? 'block' : 'none';
        document.getElementById('user-verify-section').style.display = appState.isSignup ? 'block' : 'none';
        document.getElementById('auth-submit-btn').textContent = appState.isSignup ? 'Create Account' : 'Sign In';
        authToggle.textContent = appState.isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up";
    };
    authForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const name = document.getElementById('reg-name').value;

        if (appState.isSignup && !appState.emailVerified) {
            alert("Please verify your email first.");
            return;
        }
        const url = appState.isSignup ? '/api/auth/register' : '/api/auth/login';
        const body = appState.isSignup ? { email, password, name, role: 'user' } : { email, password };
        try {
            const res = await fetch(`http://localhost:3000${url}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                if (appState.isSignup) { 
                    alert("Welcome! Sign in to continue."); 
                    appState.isSignup = false; 
                    authToggle.click(); 
                } else {
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

window.sendUserVerificationCode = async () => {
    const email = document.getElementById('login-email').value;
    if (!email) { alert("Please enter email first."); return; }
    
    const btn = document.getElementById('user-send-code-btn');
    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
        const res = await fetch('http://localhost:3000/api/auth/send_verification', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('user-code-sent-msg').style.display = 'block';
            document.getElementById('user-otp-row').style.display = 'block';
            btn.textContent = "Resend Code";
            setTimeout(() => btn.disabled = false, 5000);
        } else { alert(data.message); btn.disabled = false; btn.textContent = "Send Verification Code"; }
    } catch (err) { alert("Error connecting to server."); btn.disabled = false; btn.textContent = "Send Verification Code"; }
};

window.verifyUserCode = async () => {
    const email = document.getElementById('login-email').value;
    const code = document.getElementById('user-otp-input').value;
    if (!code) { alert("Please enter the 6-digit code."); return; }

    try {
        const res = await fetch('http://localhost:3000/api/auth/verify_code', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const data = await res.json();
        if (data.success) {
            appState.emailVerified = true;
            document.getElementById('user-verified-badge').style.display = 'inline-block';
            document.getElementById('user-otp-row').style.display = 'none';
            document.getElementById('user-code-sent-msg').style.display = 'none';
            document.getElementById('user-send-code-btn').style.display = 'none';
        } else { alert(data.message || "Invalid Code"); }
    } catch (err) { alert("Verification failed."); }
};