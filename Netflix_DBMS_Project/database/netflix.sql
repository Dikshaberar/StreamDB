CREATE DATABASE IF NOT EXISTS streamdb;
USE streamdb;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE movies (
  movie_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  genre VARCHAR(50),
  release_year INT,
  view_count INT DEFAULT 0,
  INDEX idx_title (title),
  INDEX idx_genre (genre)
);

CREATE TABLE subscriptions (
  sub_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan ENUM('Basic','Standard','Premium') NOT NULL,
  payment_status ENUM('Paid','Pending','Failed') DEFAULT 'Pending',
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE watchlist (
  user_id INT,
  movie_id INT,
  PRIMARY KEY (user_id, movie_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON DELETE CASCADE
);

CREATE TABLE watch_history (
  history_id INT AUTO_INCREMENT,
  user_id INT NOT NULL,
  movie_id INT NOT NULL,
  watch_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  duration_min INT,
  PRIMARY KEY (history_id, watch_date)
)
PARTITION BY RANGE (YEAR(watch_date)) (
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION pmax  VALUES LESS THAN MAXVALUE
);

CREATE VIEW v_user_history AS
SELECT h.history_id, u.user_id, u.name, m.title, m.genre, h.watch_date, h.duration_min
FROM watch_history h
JOIN users u ON u.user_id = h.user_id
JOIN movies m ON m.movie_id = h.movie_id;

DELIMITER //

CREATE TRIGGER trg_view_count AFTER INSERT ON watch_history
FOR EACH ROW
BEGIN
  UPDATE movies SET view_count = view_count + 1 WHERE movie_id = NEW.movie_id;
END//

CREATE PROCEDURE sp_subscribe(IN p_user INT, IN p_plan VARCHAR(20), IN p_status VARCHAR(20))
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
    DELETE FROM subscriptions WHERE user_id = p_user;
    INSERT INTO subscriptions (user_id, plan, payment_status)
    VALUES (p_user, p_plan, p_status);
  COMMIT;
END//

DELIMITER ;

INSERT INTO movies (title, genre, release_year) VALUES
('Stranger Things','Sci-Fi',2016),
('Money Heist','Thriller',2017),
('The Crown','Drama',2016),
('Dark','Sci-Fi',2017),
('Wednesday','Comedy',2022);