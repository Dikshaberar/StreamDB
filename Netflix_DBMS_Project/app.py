from flask import Flask, request, jsonify, session, render_template
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector

app = Flask(__name__)
app.secret_key = "change-this-secret"

DB = dict(host="localhost", user="root", password="your_password", database="streamdb")

def q(sql, args=(), fetch=False, one=False):
    con = mysql.connector.connect(**DB)
    cur = con.cursor(dictionary=True)
    try:
        cur.execute(sql, args)
        if fetch:
            return cur.fetchone() if one else cur.fetchall()
        con.commit()
        return cur.lastrowid
    finally:
        cur.close(); con.close()

def need_login():
    return None if "uid" in session else (jsonify(error="Login required"), 401)

def need_admin():
    return None if session.get("role") == "admin" else (jsonify(error="Admin only"), 403)

# ---------- Pages ----------
@app.route("/")
def home():       return render_template("index.html")
@app.route("/login")
def login_page(): return render_template("login.html")
@app.route("/register")
def register_page(): return render_template("register.html")
@app.route("/movies")
def movies_page(): return render_template("movies.html")
@app.route("/dashboard")
def dashboard_page(): return render_template("dashboard.html")

# ---------- Auth ----------
@app.post("/api/register")
def register():
    d = request.json
    try:
        q("INSERT INTO users (name,email,password_hash) VALUES (%s,%s,%s)",
          (d["name"], d["email"], generate_password_hash(d["password"])))
    except mysql.connector.IntegrityError:
        return jsonify(error="Email already registered"), 400
    return jsonify(ok=True)

@app.post("/api/login")
def login():
    d = request.json
    u = q("SELECT * FROM users WHERE email=%s", (d["email"],), True, True)
    if not u or not check_password_hash(u["password_hash"], d["password"]):
        return jsonify(error="Invalid credentials"), 401
    session["uid"], session["role"] = u["user_id"], u["role"]
    return jsonify(ok=True, name=u["name"], role=u["role"])

@app.post("/api/logout")
def logout():
    session.clear(); return jsonify(ok=True)

@app.get("/api/profile")
def profile():
    if (r := need_login()): return r
    return jsonify(q("SELECT user_id,name,email,role FROM users WHERE user_id=%s",
                     (session["uid"],), True, True))

# ---------- Movies ----------
@app.get("/api/movies")
def movies():
    s = "%" + request.args.get("search", "") + "%"
    return jsonify(q("SELECT * FROM movies WHERE title LIKE %s OR genre LIKE %s", (s, s), True))

@app.post("/api/movies")
def add_movie():
    if (r := need_admin()): return r
    d = request.json
    i = q("INSERT INTO movies (title,genre,release_year) VALUES (%s,%s,%s)",
          (d["title"], d["genre"], d["release_year"]))
    return jsonify(ok=True, movie_id=i)

@app.put("/api/movies/<int:mid>")
def update_movie(mid):
    if (r := need_admin()): return r
    d = request.json
    q("UPDATE movies SET title=%s,genre=%s,release_year=%s WHERE movie_id=%s",
      (d["title"], d["genre"], d["release_year"], mid))
    return jsonify(ok=True)

@app.delete("/api/movies/<int:mid>")
def delete_movie(mid):
    if (r := need_admin()): return r
    q("DELETE FROM movies WHERE movie_id=%s", (mid,))
    return jsonify(ok=True)

# ---------- My List ----------
@app.get("/api/watchlist")
def get_list():
    if (r := need_login()): return r
    return jsonify(q("""SELECT m.* FROM watchlist w JOIN movies m ON m.movie_id=w.movie_id
                        WHERE w.user_id=%s""", (session["uid"],), True))

@app.post("/api/watchlist/<int:mid>")
def add_list(mid):
    if (r := need_login()): return r
    q("INSERT IGNORE INTO watchlist VALUES (%s,%s)", (session["uid"], mid))
    return jsonify(ok=True)

@app.delete("/api/watchlist/<int:mid>")
def remove_list(mid):
    if (r := need_login()): return r
    q("DELETE FROM watchlist WHERE user_id=%s AND movie_id=%s", (session["uid"], mid))
    return jsonify(ok=True)

# ---------- Watch + History ----------
@app.post("/api/watch/<int:mid>")
def watch(mid):
    if (r := need_login()): return r
    dur = (request.json or {}).get("duration_min", 0)
    q("INSERT INTO watch_history (user_id,movie_id,duration_min) VALUES (%s,%s,%s)",
      (session["uid"], mid, dur))
    return jsonify(ok=True)

@app.get("/api/history")
def history():
    if (r := need_login()): return r
    rows = q("""SELECT title,genre,watch_date,duration_min FROM v_user_history
                WHERE user_id=%s ORDER BY watch_date DESC""", (session["uid"],), True)
    for x in rows: x["watch_date"] = str(x["watch_date"])
    return jsonify(rows)

@app.get("/api/top-movies")
def top():
    return jsonify(q("SELECT title,view_count FROM movies ORDER BY view_count DESC LIMIT 5", fetch=True))

# ---------- Subscription ----------
@app.post("/api/subscribe")
def subscribe():
    if (r := need_login()): return r
    d = request.json
    con = mysql.connector.connect(**DB); cur = con.cursor()
    cur.callproc("sp_subscribe", (session["uid"], d["plan"], d.get("status", "Paid")))
    con.commit(); cur.close(); con.close()
    return jsonify(ok=True)

if __name__ == "__main__":
    app.run(debug=True)