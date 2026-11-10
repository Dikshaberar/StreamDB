// ======================================
// STREAMDB - MAIN JAVASCRIPT
// ======================================

async function api(url, method = "GET", body) {
    try {
        const r = await fetch(url, {
            method,
            headers: {"Content-Type": "application/json"},
            body: body ? JSON.stringify(body) : undefined
        });

        let data = {};
        try {
            data = await r.json();
        } catch (e) {}

        return {ok: r.ok, data};

    } catch (error) {
        console.error(error);
        showToast("Something went wrong!");
        return {ok: false, data: {}};
    }
}

let ME = null;


// ======================================
// TOAST NOTIFICATION
// ======================================

function showToast(message) {

    let toast = document.getElementById("toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        document.body.appendChild(toast);
    }

    toast.innerText = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


// ======================================
// NAVIGATION
// ======================================

async function loadNav() {

    const p = await api("/api/profile");

    ME = p.ok ? p.data : null;

    const nav = document.getElementById("nav");

    if (!nav) return;

    nav.innerHTML = `
        <span class="logo">STREAM<span style="color:white">DB</span></span>

        <div class="nav-links">
            <a href="/">Home</a>
            <a href="/movies">Movies</a>

            ${ME ? `
                <a href="/dashboard">Dashboard</a>
                <a href="#" onclick="logout()">Logout (${escapeHTML(ME.name)})</a>
            ` : `
                <a href="/login">Login</a>
                <a href="/register">Register</a>
            `}
        </div>
    `;
}


async function logout() {

    await api("/api/logout", "POST");

    location.href = "/";
}


// ======================================
// SECURITY HELPER
// ======================================

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


function v(id) {

    const element = document.getElementById(id);

    return element ? element.value : "";
}


// ======================================
// REGISTER
// ======================================

async function doRegister() {

    const r = await api("/api/register", "POST", {
        name: v("name"),
        email: v("email"),
        password: v("password")
    });

    if (r.ok) {

        showToast("Registration successful!");

        setTimeout(() => {
            location.href = "/login";
        }, 1000);

    } else {

        document.getElementById("msg").innerText =
            r.data.error || "Registration failed";
    }
}


// ======================================
// LOGIN
// ======================================

async function doLogin() {

    const r = await api("/api/login", "POST", {
        email: v("email"),
        password: v("password")
    });

    if (r.ok) {

        showToast("Welcome to StreamDB!");

        setTimeout(() => {
            location.href = "/movies";
        }, 1000);

    } else {

        document.getElementById("msg").innerText =
            r.data.error || "Invalid login details";
    }
}


// ======================================
// MOVIE POSTER BACKGROUNDS
// ======================================

const movieImages = [
    "photo-1489599849927-2ee91cede3ba",
    "photo-1440404653325-ab127d49abc1",
    "photo-1478720568477-152d9b164e26",
    "photo-1517604931442-7e0c8ed2963c",
    "photo-1485846234645-a62644f84728",
    "photo-1500530855697-b586d89ba3ee"
];

function getMovieImage(index) {

    const image = movieImages[index % movieImages.length];

    return `https://images.unsplash.com/${image}?auto=format&fit=crop&w=600&q=80`;
}


// ======================================
// LOAD MOVIES
// ======================================

async function loadMovies() {

    const search = encodeURIComponent(v("search"));

    const grid = document.getElementById("grid");

    if (!grid) return;

    grid.innerHTML = "<p>Loading movies...</p>";

    const r = await api("/api/movies?search=" + search);

    if (!r.ok || !Array.isArray(r.data)) {

        grid.innerHTML = "<p>Unable to load movies.</p>";

        return;
    }

    if (r.data.length === 0) {

        grid.innerHTML = `
            <div class="empty-state">
                <h2>😔 No Movies Found</h2>
                <p>Try searching for another movie.</p>
            </div>
        `;

        return;
    }

    grid.innerHTML = r.data.map((m, index) => `

        <div class="movie-card">

            <div class="movie-poster">

                <img
                    src="${getMovieImage(index)}"
                    alt="${escapeHTML(m.title)}"
                    loading="lazy"
                >

                <div class="poster-overlay">

                    <span class="movie-badge">STREAMDB</span>

                    <div class="poster-actions">

                        <button onclick="play(${Number(m.movie_id)})">
                            ▶ Play
                        </button>

                        <button class="list-btn"
                            onclick="addList(${Number(m.movie_id)})">
                            + My List
                        </button>

                    </div>

                </div>

            </div>

            <div class="movie-details">

                <h3>${escapeHTML(m.title)}</h3>

                <p>
                    ${escapeHTML(m.genre)}
                    • ${escapeHTML(m.release_year)}
                </p>

                <span class="views">
                    👁 ${Number(m.view_count) || 0} Views
                </span>

                ${ME && ME.role === "admin" ? `
                    <button class="delete-btn"
                        onclick="delMovie(${Number(m.movie_id)})">
                        Delete Movie
                    </button>
                ` : ""}

            </div>

        </div>

    `).join("");
}


// ======================================
// LOGIN CHECK
// ======================================

function needLogin() {

    if (!ME) {

        showToast("Please login first!");

        setTimeout(() => {
            location.href = "/login";
        }, 1000);

        return true;
    }

    return false;
}


// ======================================
// PLAY MOVIE
// ======================================

async function play(id) {

    if (needLogin()) return;

    const mins = Math.floor(Math.random() * 90) + 20;

    const r = await api("/api/watch/" + id, "POST", {
        duration_min: mins
    });

    if (r.ok) {

        showToast("Movie added to watch history!");

        loadMovies();

    } else {

        showToast("Unable to update watch history.");
    }
}


// ======================================
// ADD TO WATCHLIST
// ======================================

async function addList(id) {

    if (needLogin()) return;

    const r = await api("/api/watchlist/" + id, "POST");

    if (r.ok) {

        showToast("❤️ Added to My List!");

    } else {

        showToast(r.data.error || "Could not add movie.");
    }
}


// ======================================
// ADD MOVIE - ADMIN
// ======================================

async function addMovie() {

    const r = await api("/api/movies", "POST", {

        title: v("t"),
        genre: v("g"),
        release_year: v("y")

    });

    if (r.ok) {

        showToast("Movie added successfully!");

        document.getElementById("t").value = "";
        document.getElementById("g").value = "";
        document.getElementById("y").value = "";

        loadMovies();

    } else {

        showToast(r.data.error || "Unable to add movie.");
    }
}


// ======================================
// DELETE MOVIE
// ======================================

async function delMovie(id) {

    if (!confirm("Are you sure you want to delete this movie?")) {
        return;
    }

    const r = await api("/api/movies/" + id, "DELETE");

    if (r.ok) {

        showToast("Movie deleted!");

        loadMovies();

    } else {

        showToast("Unable to delete movie.");
    }
}


// ======================================
// TOP MOVIES
// ======================================

async function loadTop() {

    const top = document.getElementById("top");

    if (!top) return;

    const r = await api("/api/top-movies");

    if (!r.ok || !Array.isArray(r.data)) return;

    top.innerHTML = r.data.map(m => `

        <tr>
            <td>🎬 ${escapeHTML(m.title)}</td>
            <td>${Number(m.view_count) || 0}</td>
        </tr>

    `).join("");
}


// ======================================
// DASHBOARD
// ======================================

async function loadDashboard() {

    if (needLogin()) return;

    document.getElementById("info").innerText =
        `${ME.name} (${ME.email})`;

    const h = await api("/api/history");

    document.getElementById("hist").innerHTML =
        (Array.isArray(h.data) ? h.data : []).map(x => `

            <tr>
                <td>${escapeHTML(x.title)}</td>
                <td>${escapeHTML(x.genre)}</td>
                <td>${escapeHTML(x.watch_date)}</td>
                <td>${Number(x.duration_min)} min</td>
            </tr>

        `).join("") || "<tr><td colspan='4'>No history found</td></tr>";


    const l = await api("/api/watchlist");

    document.getElementById("list").innerHTML =
        (Array.isArray(l.data) ? l.data : []).map(m => `

            <div class="card">

                <h3>${escapeHTML(m.title)}</h3>

                <p>${escapeHTML(m.genre)}</p>

                <button class="grey"
                    onclick="removeList(${Number(m.movie_id)})">
                    Remove
                </button>

            </div>

        `).join("") || "<p>Your watchlist is empty.</p>";

    loadTop();
}


// ======================================
// REMOVE FROM WATCHLIST
// ======================================

async function removeList(id) {

    const r = await api("/api/watchlist/" + id, "DELETE");

    if (r.ok) {

        showToast("Removed from My List!");

        loadDashboard();
    }
}


// ======================================
// SUBSCRIPTION
// ======================================

async function subscribe() {

    const r = await api("/api/subscribe", "POST", {

        plan: v("plan"),
        status: "Paid"

    });

    if (r.ok) {

        showToast("Subscription updated!");

    } else {

        showToast("Subscription failed.");
    }
}