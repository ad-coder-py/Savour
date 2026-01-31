// State Management
const appState = {
    currentStep: 1,
    preferences: {
        budget: 500,
        cuisine: null,
        diet: 'Any',
    },
    // Sidebar Filters (Step 4)
    filters: {
        serviceMode: 'Dine-in',
        minRating: 3.5,
        facilities: []
    },
    userLocation: null,
    restaurants: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCursor();
    initBudgetSlider();
    loadRestaurants();
    getUserLocation();
    renderCuisineOptions();
    setupEventListeners();
});

function setupEventListeners() {
    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Login Modal
    const loginModal = document.getElementById('login-modal');
    document.getElementById('login-btn').addEventListener('click', () => {
        loginModal.style.display = 'flex';
    });
    document.querySelector('.close-modal').addEventListener('click', () => {
        loginModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) loginModal.style.display = 'none';
    });
}

// --- Theme System ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        icon.style.color = '#FBBF24'; // Sun color
    } else {
        icon.className = 'fas fa-moon';
        icon.style.color = '#1F2933'; // Moon color
    }
}

// --- Custom Magnetic Cursor & IEmoji Trail ---
function initCursor() {
    const dot = document.querySelector('.cursor-dot');
    const outline = document.querySelector('.cursor-outline');

    window.addEventListener('mousemove', (e) => {
        const posX = e.clientX;
        const posY = e.clientY;

        // Dot follows instantly
        dot.style.left = `${posX}px`;
        dot.style.top = `${posY}px`;

        // Outline uses animate for smooth trailing
        outline.animate({
            left: `${posX}px`,
            top: `${posY}px`
        }, { duration: 500, fill: "forwards" });

        // Emoji Trail
        if (Math.random() > 0.85) { // Throttle creation
            createEmojiTrail(posX, posY);
        }
    });

    // Magnetic Pull & Hover Effects
    const interactiveElements = document.querySelectorAll('button, a, input, .selection-card, .toggle-btn, label');

    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            document.body.classList.add('hover-magnet');
        });
        el.addEventListener('mouseleave', () => {
            document.body.classList.remove('hover-magnet');
        });
    });
}

function createEmojiTrail(x, y) {
    const emojis = ['🍕', '🍔', '🍟', '🍩', '🥤', '🌮', '🍜'];
    const el = document.createElement('div');
    el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.position = 'fixed';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = '1.2rem';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9998';
    el.style.opacity = '0.7';
    // Random subtle movement
    el.style.transform = `translate(-50%, -50%) scale(${Math.random() * 0.4 + 0.6})`;
    el.style.transition = 'all 0.8s ease-out';

    document.body.appendChild(el);

    // Animate away (float up/down slightly)
    requestAnimationFrame(() => {
        const randX = (Math.random() - 0.5) * 50;
        const randY = (Math.random() - 0.5) * 50 - 50; // Tend upwards
        el.style.transform = `translate(calc(-50% + ${randX}px), calc(-50% + ${randY}px)) scale(0)`;
        el.style.opacity = '0';
    });

    setTimeout(() => {
        el.remove();
    }, 800);
}

// --- Data Layer ---
async function loadRestaurants() {
    try {
        const response = await fetch('restaurants.json');
        appState.restaurants = await response.json();
    } catch (error) {
        console.error('Failed to load restaurants:', error);
    }
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                appState.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
            },
            (error) => {
                // Default: Bangalore Center
                appState.userLocation = { lat: 12.9716, lng: 77.5946 };
            }
        );
    } else {
        appState.userLocation = { lat: 12.9716, lng: 77.5946 };
    }
}

// --- Step 1: Budget ---
function initBudgetSlider() {
    const slider = document.getElementById('budget-range');
    const display = document.getElementById('budget-display');

    slider.addEventListener('input', (e) => {
        appState.preferences.budget = parseInt(e.target.value);
        display.textContent = `₹${e.target.value}`;
    });
}

// --- Step 2: Cuisine ---
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
        const card = document.createElement('div');
        card.className = 'selection-card';
        card.innerHTML = `
            <i class="fas ${c.icon}" style="font-size: 2.5rem; color: var(--secondary);"></i>
            <h3 style="margin-top:1rem;">${c.name}</h3>
        `;
        card.addEventListener('click', () => {
            document.querySelectorAll('#cuisine-grid .selection-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
            appState.preferences.cuisine = c.name;
        });
        // Add magnet listeners to dynamic elements
        card.addEventListener('mouseenter', () => document.body.classList.add('hover-magnet'));
        card.addEventListener('mouseleave', () => document.body.classList.remove('hover-magnet'));

        grid.appendChild(card);
    });
}

// --- Step 3: Dietary ---
window.selectDiet = (type, element) => {
    document.querySelectorAll('#step-3 .selection-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    appState.preferences.diet = type;
};

// --- Step 4: Logic & Rendering ---

// Sidebar Actions
window.setServiceMode = (mode, btn) => {
    appState.filters.serviceMode = mode;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    calculateAndRenderResults(); // Real-time update
};

window.updateRatingDisplay = (val) => {
    appState.filters.minRating = parseFloat(val);
    document.getElementById('rating-val').innerText = val;
    calculateAndRenderResults(); // Real-time update
};

window.toggleFacility = (facility) => {
    const index = appState.filters.facilities.indexOf(facility);
    if (index === -1) {
        appState.filters.facilities.push(facility);
    } else {
        appState.filters.facilities.splice(index, 1);
    }
    calculateAndRenderResults(); // Real-time update
};


// Navigation
window.nextStep = (stepNumber) => {
    if (stepNumber === 3 && !appState.preferences.cuisine) {
        alert("Please select a cuisine!");
        return;
    }

    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${stepNumber}`).classList.add('active');
    appState.currentStep = stepNumber;

    if (stepNumber === 4) {
        calculateAndRenderResults();
    }
};

window.showResults = () => {
    nextStep(4);
};

// Core Recommendation Algorithm
function calculateAndRenderResults() {
    const resultsContainer = document.getElementById('results-container');
    // Don't show loading on small filter updates to feel "snappy"
    // resultsContainer.innerHTML = '<p>Updating...</p>';

    const scoredRestaurants = appState.restaurants.map(r => {
        let score = 0;

        // --- Hard Filters ---

        // 1. Dietary Preference
        if (appState.preferences.diet === 'Veg' && !r.isVeg) return { ...r, score: -1 };

        // 2. Minimum Rating
        if (r.rating < appState.filters.minRating) return { ...r, score: -1 };

        // 3. Facilities
        const hasAllFacilities = appState.filters.facilities.every(f => r.facilities.includes(f));
        if (!hasAllFacilities) return { ...r, score: -1 };

        // --- Scoring ---

        // 1. Cuisine Match (High Impact)
        if (r.cuisine === appState.preferences.cuisine) score += 50;

        // 2. Budget Proximity
        const budgetDiff = Math.abs((r.budget === 'Low' ? 200 : r.budget === 'Medium' ? 600 : 1500) - appState.preferences.budget);
        if (budgetDiff < 300) score += 30;
        else if (budgetDiff < 600) score += 10;

        // 3. Distance
        const dist = getDistanceFromLatLonInKm(
            appState.userLocation.lat, appState.userLocation.lng,
            r.coords.lat, r.coords.lng
        );
        if (dist < 3) score += 40;
        else if (dist < 7) score += 20;
        else score -= (dist * 2); // Penalty per km

        // 4. Service Mode Bonus (Soft Filter)
        // We assume all support Dine-in for this demo unless specified
        // But let's check against our static data just in case
        if (appState.filters.serviceMode === 'Takeaway') {
            // In a real app we'd check if specific service mode is supported
            // For now, give a small arbitrary boost
            score += 5;
        }

        return { ...r, score, calculatedDist: dist.toFixed(1) };
    });

    // Filter & Sort
    const filtered = scoredRestaurants
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score);

    renderResults(filtered);
}

function renderResults(restaurants) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    if (restaurants.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
                <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No spots match accurately.</h3>
                <p>Try lowering the rating filter or unchecking facilities.</p>
            </div>
        `;
        return;
    }

    restaurants.forEach(r => {
        const card = document.createElement('div');
        card.className = 'restaurant-card';
        // Add magnet effect to new cards
        card.addEventListener('mouseenter', () => document.body.classList.add('hover-magnet'));
        card.addEventListener('mouseleave', () => document.body.classList.remove('hover-magnet'));

        const tagsHtml = r.facilities.slice(0, 3).map(f => `<span class="tag">${f}</span>`).join('');

        card.innerHTML = `
            <img src="${r.image}" class="card-image" alt="${r.name}">
            <div class="card-content">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <h3>${r.name}</h3>
                    <span class="rating-badge">${r.rating} ★</span>
                </div>
                <div class="meta-info">
                    <span>${r.cuisine} • ${r.budget}</span>
                    <span>${r.calculatedDist} km</span>
                </div>
                <div class="tag-cloud">
                    ${r.isVeg ? '<span class="tag" style="border-color:var(--success); color:var(--success);">Veg</span>' : ''}
                    ${tagsHtml}
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn-action" onclick="alert('Navigating...')"><i class="fas fa-location-arrow"></i></button>
                    <button class="btn-action" style="background: var(--primary); color: #fff; flex:1;" onclick="alert('Booked!')">Book Table</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function deg2rad(deg) { return deg * (Math.PI / 180) }
