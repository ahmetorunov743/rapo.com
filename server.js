/**
 * RAPO — backend (Express + PostgreSQL)
 * ------------------------------------------------------------------
 * Эндпоинты соответствуют функциям из assets/js/data.remote.js:
 *   POST   /api/register
 *   POST   /api/login
 *   GET    /api/me
 *   GET    /api/ads?query=...
 *   GET    /api/ads/:id
 *   GET    /api/users/:id/ads
 *   POST   /api/ads
 *   DELETE /api/ads/:id
 *
 * Перед запуском:
 *   1. npm install
 *   2. Создайте БД и выполните schema.sql
 *   3. Задайте переменные окружения DATABASE_URL и JWT_SECRET
 *   4. npm start
 *
 * См. README.md в этой папке — там про деплой (Render/Railway/Fly.io)
 * и про то, как переключить фронтенд на эту реализацию.
 */
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function publicUser(row) {
  return { id: row.id.toString(), username: row.username, email: row.email };
}

function sign(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Нужна авторизация.' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Сессия недействительна, войдите снова.' });
  }
}

// ---- Auth ----

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'Заполните все поля.' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Этот email уже зарегистрирован.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    );
    const user = publicUser(result.rows[0]);
    res.json({ token: sign(user.id), user });
  } catch (err) {
    res.status(500).json({ error: 'Не удалось создать аккаунт.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: 'Неверный email или пароль.' });
    }
    res.json({ token: sign(row.id), user: publicUser(row) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка входа.' });
  }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.userId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Пользователь не найден.' });
  res.json(publicUser(result.rows[0]));
});

// ---- Ads ----

app.get('/api/ads', async (req, res) => {
  const { query } = req.query;
  try {
    const result = query
      ? await pool.query(
          `SELECT ads.*, users.username AS author FROM ads JOIN users ON users.id = ads.user_id
           WHERE ads.title ILIKE $1 OR ads.description ILIKE $1 ORDER BY ads.created_at DESC`,
          ['%' + query + '%']
        )
      : await pool.query(
          `SELECT ads.*, users.username AS author FROM ads JOIN users ON users.id = ads.user_id
           ORDER BY ads.created_at DESC`
        );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Не удалось загрузить объявления.' });
  }
});

app.get('/api/ads/:id', async (req, res) => {
  const result = await pool.query(
    `SELECT ads.*, users.username AS author FROM ads JOIN users ON users.id = ads.user_id WHERE ads.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Объявление не найдено.' });
  res.json(result.rows[0]);
});

app.get('/api/users/:id/ads', async (req, res) => {
  const result = await pool.query('SELECT * FROM ads WHERE user_id = $1 ORDER BY created_at DESC', [req.params.id]);
  res.json(result.rows);
});

app.post('/api/ads', authMiddleware, async (req, res) => {
  const { title, description, price, contact } = req.body || {};
  if (!title || !description) return res.status(400).json({ error: 'Укажите заголовок и описание.' });
  try {
    const result = await pool.query(
      'INSERT INTO ads (user_id, title, description, price, contact) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, title, description, price || null, contact || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Не удалось создать объявление.' });
  }
});

app.delete('/api/ads/:id', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT user_id FROM ads WHERE id = $1', [req.params.id]);
  const ad = result.rows[0];
  if (!ad) return res.status(404).json({ error: 'Объявление не найдено.' });
  if (ad.user_id.toString() !== req.userId.toString()) return res.status(403).json({ error: 'Нет доступа к удалению этого объявления.' });
  await pool.query('DELETE FROM ads WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('RAPO API запущен на порту ' + PORT));
