
let appState = {
    step: 1,
    preferences: { budget: 500, cuisine: null, diet: 'Any', amenities: [] },
    user: JSON.parse(localStorage.getItem('user')) || null,
    // Set to your specific starting location: College Of Engineering, Adoor
    userLocation: { lat: 9.1323982, lng: 76.718111 },
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
        
        // Ultimate location request with fallback 
        window.requestLocation = (callback) => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(pos => {
                const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                if(!appState.userLocation || Math.abs(appState.userLocation.lat - newLoc.lat) > 0.0001) {
                    appState.userLocation = newLoc;
                    if (window._updateDetailsLoc) window._updateDetailsLoc();
                }
                if (callback) callback(appState.userLocation);
            }, null, { enableHighAccuracy: true, timeout: 5000 });
        };
        window.requestLocation();
    } catch (e) { console.error(e); }
});

window.setManualLocation = () => {
    const loc = prompt("Enter your City or Area name (e.g. 'Bangalore' or 'Kottayam'):");
    if(loc) {
        appState.manualLocationName = loc;
        appState.userLocation = null; // Clear coordinates to prioritize name
        alert("Location set to: " + loc);
        if (window._updateDetailsLoc) window._updateDetailsLoc();
    }
};

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

    const startSearch = async (coords) => {
        const uLat = coords.lat;
        const uLng = coords.lng;
        appState.userLocation = coords;

        try {
            const response = await fetch('http://localhost:3000/api/recommend', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cuisine: appState.preferences.cuisine })
            });
            let data = await response.json();

            data = data.map(r => {
                const dist = (r.lat && r.lng) ? getDistanceFromLatLonInKm(uLat, uLng, r.lat, r.lng) : 9999;
                return { ...r, distance: dist };
            }).sort((a, b) => a.distance - b.distance);

            currentResults = data;
            renderList(data);
        } catch (err) { container.innerHTML = `<h3>Server connection lost.</h3>`; }
    };

    if (appState.userLocation) {
        startSearch(appState.userLocation);
    } else {
        navigator.geolocation.getCurrentPosition(pos => {
            startSearch({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }, () => {
            container.innerHTML = `<div style="text-align:center; padding:5rem;"><i class="fas fa-map-marker-alt" style="font-size:4rem; opacity:0.3;"></i><h3>Location access required.</h3><button class="btn-login" onclick="window.requestLocation(() => showResults())" style="margin-top:1rem;">Retry Detection</button></div>`;
        }, { enableHighAccuracy: true });
    }
};

function renderList(list) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<h3 style="grid-column:1/-1; text-align:center;">No restaurants match your filters. Try widening your search!</h3>`;
        return;
    }

    // ONLY SHOW THE NEAREST RESTAURANT
    const nearestOnly = [list[0]];

    nearestOnly.forEach((r, idx) => {
        const isNearest = idx === 0 && r.distance < 10;
        const div = document.createElement('div');
        div.className = 'premium-card';
        const fallbackImg = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500';
        
        // Filter for approved dishes and prepare for display
        const approvedDishes = (r.dishes || []).filter(d => d.status === 'approved');
        const dishesHtml = approvedDishes.slice(0, 3).map(d => `<span>${d.name}</span>`).join('') || '<span>Tasty Selection</span>';
        const dishesMore = approvedDishes.length > 3 ? `<span class="tag-sm" style="font-size:0.75rem; background:var(--background); padding:0.3rem 0.6rem; border-radius:6px; border:1px solid var(--border);">+${approvedDishes.length - 3} more</span>` : '';

        div.innerHTML = `
            <div class="card-image-wrap">
                <img src="${(r.image && r.image.trim() !== '') ? r.image : fallbackImg}">
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
                <div class="tag-row" style="margin-top:0.5rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
                    ${dishesHtml} ${dishesMore}
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

    // Show approved dishes to everyone, but show ALL dishes (even pending) to the owner
    const isOwner = appState.user && appState.user.email === r.ownerEmail;
    const approvedMenu = (r.dishes || []).filter(d => isOwner || d.status === 'approved');

    const fallbackHero = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000';
    const fallbackDish = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200';

    document.getElementById('details-body').innerHTML = `
        <div class="details-hero">
            <img src="${(r.image && r.image.trim() !== '') ? r.image : fallbackHero}" class="details-hero-img">
            <div class="details-overlay-info">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <h1 style="font-size:3.5rem; margin-bottom:0.5rem; font-family:var(--font-heading); line-height:1;">${r.name}</h1>
                        <p id="details-hero-dist" style="font-size:1.1rem; opacity:0.9;"><i class="fas fa-map-marker-alt"></i> ${r.cuisine} • ${r.distance ? (r.distance < 1 ? (r.distance*1000).toFixed(0) + ' m' : r.distance.toFixed(1) + ' km') : 'calculating...'} away</p>
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
                <div class="dish-grid-modern" id="details-menu-grid">
                    ${approvedMenu.map(d => `
                        <div class="dish-card-modern">
                            <img src="${(d.img && d.img.trim() !== '') ? d.img : fallbackDish}">
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
                    <div id="map-container" style="height: 350px; border-radius: 20px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 2rem; z-index:1;">
                        <iframe width="100%" height="100%" frameborder="0" style="border:0" 
                            src="https://www.google.com/maps?q=${r.lat},${r.lng}&t=&z=17&ie=UTF8&iwloc=&output=embed" allowfullscreen>
                        </iframe>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                         <div style="background:var(--background); padding:1rem; border-radius:16px; text-align:center;">
                            <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted);">Distance</div>
                            <div id="details-dist" style="font-weight:700;">N/A</div>
                         </div>
                         <div style="background:var(--background); padding:1rem; border-radius:16px; text-align:center;">
                            <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted);">Est. Time</div>
                            <div id="details-time" style="font-weight:700;">N/A</div>
                         </div>
                    </div>
                     <div id="gps-status-bar" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; font-size:0.75rem; margin-bottom:1rem; padding:0.5rem; background:rgba(0,0,0,0.03); border-radius:12px;">
                         <span id="gps-dot" style="width:8px; height:8px; border-radius:50%; background:#ccc;"></span>
                         <span id="gps-text">Waiting for GPS...</span>
                         <button class="btn-ghost" onclick="setManualLocation()" style="color:var(--primary); text-decoration:underline; font-size:0.7rem; padding:0; margin-left:auto;">(Use City Name instead)</button>
                     </div>
                     <button id="gmaps-dir-btn" class="btn-login" style="width:100%; padding:1.2rem; font-size:1.1rem; border-radius:18px; display:flex; align-items:center; justify-content:center; gap:0.8rem;" onclick="goToDirections(${r.lat}, ${r.lng})">
                         <i class="fas fa-directions"></i> Get Exact Directions
                     </button>
                </div>
            </div>
        </div>
        
        <div class="reviews-section" style="padding: 2rem 5%; background: var(--background);">
            <div style="max-width: 1200px; margin: 0 auto;">
                <h3 style="font-family: var(--font-heading); font-size: 2rem; margin-bottom: 1.5rem;">Guest Reviews</h3>
                
                ${appState.user ? `
                    <div class="review-box premium-glass" style="padding:1.5rem; margin-bottom:2rem; border-radius:16px; border:1px solid var(--border);">
                        <h4 style="margin-bottom:1rem;">Write a Review</h4>
                        <div style="display:flex; gap:0.5rem; margin-bottom:1rem; color:var(--secondary);" id="review-stars-input">
                            ${[1,2,3,4,5].map(s => `<i class="far fa-star" onclick="setReviewRating(${s})" style="cursor:pointer; font-size:1.2rem;" data-val="${s}"></i>`).join('')}
                        </div>
                        <textarea id="review-comment" placeholder="Share your experience..." style="width:100%; padding:1rem; border-radius:12px; border:1px solid var(--border); background:var(--background-alt); margin-bottom:1rem; min-height:100px;"></textarea>
                        <button class="btn-primary-glow" style="padding:0.8rem 2rem;" onclick="submitReview(${r.id})">Post Review</button>
                    </div>
                ` : `
                    <div style="padding:1.5rem; text-align:center; background:var(--background-alt); border-radius:16px; margin-bottom:2rem;">
                        <p>Please <a href="#" onclick="document.getElementById('login-btn').click(); return false;">Login</a> to post a review.</p>
                    </div>
                `}

                <div id="reviews-list">
                    ${(r.reviews || []).length > 0 ? r.reviews.map(rev => `
                        <div class="review-card" style="padding:1.5rem; border-bottom:1px solid var(--border);">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                                <div style="font-weight:700;">${rev.user}</div>
                                <div style="color:var(--text-muted); font-size:0.8rem;">${rev.date}</div>
                            </div>
                            <div style="color:var(--secondary); margin-bottom:0.5rem;">${'★'.repeat(rev.rating)}${'☆'.repeat(5-rev.rating)}</div>
                            <p style="color:var(--text-main); font-size:0.95rem;">${rev.comment}</p>
                        </div>
                    `).join('') : '<p style="text-align:center; opacity:0.5; padding:2rem;">No reviews yet. Be the first!</p>'}
                </div>
            </div>
        </div>
    `;

    document.getElementById('details-modal').style.display = 'flex';

    // Distance/Time logic refinement
    const updateLocUI = () => {
        const distEl = document.getElementById('details-dist');
        const timeEl = document.getElementById('details-time');
        const heroDistEl = document.getElementById('details-hero-dist');
        const gpsDot = document.getElementById('gps-dot');
        const gpsText = document.getElementById('gps-text');
        if (!distEl || !timeEl || !gpsDot) return;
        
        if (appState.userLocation && r.lat && r.lng) {
            const distance = getDistanceFromLatLonInKm(appState.userLocation.lat, appState.userLocation.lng, r.lat, r.lng);
            const travelTime = Math.ceil((distance / 25) * 60) + 5; 
            const distStr = distance < 1 ? `${(distance*1000).toFixed(0)} m` : `${distance.toFixed(1)} km`;
            
            distEl.innerText = `${distStr} from you`;
            timeEl.innerText = `~${travelTime} mins travel`;
            if(heroDistEl) heroDistEl.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${r.cuisine} • ${distStr} away`;
            
            gpsDot.style.background = "#4caf50";
            gpsText.innerText = `GPS Lock: ${appState.userLocation.lat.toFixed(2)}, ${appState.userLocation.lng.toFixed(2)}`;
        } else if (appState.manualLocationName) {
            distEl.innerText = "Location Set";
            timeEl.innerText = "Check Maps";
            gpsDot.style.background = "#2196f3";
            gpsText.innerText = `Using: ${appState.manualLocationName}`;
        } else {
            distEl.innerText = "Calculating...";
            gpsDot.style.background = "#ff9800";
            gpsText.innerText = "Finding you...";
        }
    };

    updateLocUI();
    if (!appState.userLocation && !appState.manualLocationName) window.requestLocation();
    window._updateDetailsLoc = updateLocUI;
};

// GLOBAL DIRECTIONS HANDLER
window.goToDirections = (dLat, dLng) => {
    let origin = 'My+Location'; // Standard keyword for browser detection
    
    if (appState.userLocation) {
        origin = `${appState.userLocation.lat},${appState.userLocation.lng}`;
    } else if (appState.manualLocationName) {
        origin = encodeURIComponent(appState.manualLocationName);
    }
    
    // Explicitly use Google's directions API with driving mode
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dLat},${dLng}&travelmode=driving`;
    window.open(url, '_blank');
};

window.detectUserLocation = () => {
    const distEl = document.getElementById('details-dist');
    if (distEl) distEl.innerText = "Detecting...";
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            appState.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (window._updateDetailsLoc) window._updateDetailsLoc();
        }, () => {
            if (distEl) distEl.innerText = "Location denied.";
        }, { enableHighAccuracy: true, timeout: 10000 });
    }
};

let currentReviewRating = 0;
window.setReviewRating = (rating) => {
    currentReviewRating = rating;
    document.querySelectorAll('#review-stars-input i').forEach(star => {
        const val = parseInt(star.getAttribute('data-val'));
        star.className = val <= rating ? 'fas fa-star' : 'far fa-star';
    });
};

window.submitReview = async (resId) => {
    const comment = document.getElementById('review-comment').value;
    if (currentReviewRating === 0) return alert("Please pick a rating!");
    if (!comment) return alert("Please write a comment!");

    const review = {
        user: appState.user.name,
        rating: currentReviewRating,
        comment: comment,
        date: new Date().toLocaleDateString()
    };

    try {
        const res = await fetch('http://localhost:3000/api/restaurant/add_review', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantId: resId, review })
        });
        if (res.ok) {
            alert("Review submitted!");
            openDetails(resId);
        }
    } catch (err) { alert("Failed to post review"); }
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
        document.getElementById('login-otp-section').style.display = 'none';
        document.getElementById('login-password').style.display = 'block';
        document.getElementById('auth-submit-btn').textContent = appState.isSignup ? 'Create Account' : 'Sign In';
        authToggle.textContent = appState.isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up";
    };
    authForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const name = document.getElementById('reg-name').value;
        const otp = document.getElementById('login-otp-input').value;

        if (appState.isSignup && !appState.emailVerified) {
            alert("Please verify your email first.");
            return;
        }
        const url = appState.isSignup ? '/api/auth/register' : '/api/auth/login';
        const body = appState.isSignup ? { email, password, name, role: 'user' } : { email, password, otp };
        const btn = document.getElementById('auth-submit-btn');
        const originalText = btn.textContent;

        btn.disabled = true;
        btn.textContent = "Processing...";

        try {
            const res = await fetch(`http://localhost:3000${url}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                if (appState.isSignup) { 
                    alert("Welcome to SAVOUR! Please sign in with your new account."); 
                    appState.isSignup = false; 
                    authToggle.click(); 
                } else if (data.otp_required) {
                    document.getElementById('login-otp-section').style.display = 'block';
                    document.getElementById('login-password').style.display = 'none';
                    document.getElementById('auth-submit-btn').textContent = 'Verify & Sign In';
                    alert("OTP sent to your email!");
                } else {
                    appState.user = data.user;
                    localStorage.setItem('user', JSON.stringify(data.user));
                    authModal.style.display = 'none';
                    // Reset UI
                    document.getElementById('login-otp-section').style.display = 'none';
                    document.getElementById('login-password').style.display = 'block';
                    document.getElementById('auth-submit-btn').textContent = 'Sign In';
                    
                    updateAuthUI();
                    loadUserHistory();
                    if(data.user.role === 'partner') {
                        if(confirm("Welcome back, Partner! Would you like to go to your Dashboard?")) {
                            window.location.href = 'owner.html';
                        }
                    }
                }
            } else { 
                alert(data.message || "Authentication failed."); 
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (err) { 
            alert("Server connection failed. Please ensure the server is running."); 
            btn.disabled = false;
            btn.textContent = originalText;
        }
        finally {
            if (!appState.user) {
                btn.disabled = false;
                if (!document.getElementById('login-otp-section').style.display || document.getElementById('login-otp-section').style.display === 'none') {
                    btn.textContent = originalText;
                }
            }
        }
    };

    document.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
}


function updateAuthUI() {
    const loginBtn = document.getElementById('login-btn');
    const dashBtn = document.getElementById('dashboard-btn');
    if (appState.user) {
        loginBtn.textContent = `Logout (${appState.user.name})`;
        document.getElementById('user-history-section').style.display = 'block';
        if(appState.user.role === 'partner' && dashBtn) dashBtn.style.display = 'inline-block';
    } else {
        loginBtn.textContent = 'Login';
        document.getElementById('user-history-section').style.display = 'none';
        if(dashBtn) dashBtn.style.display = 'none';
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