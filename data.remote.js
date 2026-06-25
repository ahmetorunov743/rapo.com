/**
 * RAPO — слой данных, REST-версия
 * ------------------------------------------------------------------
 * Подключите этот файл ВМЕСТО assets/js/data.js на каждой странице,
 * когда backend из папки /server будет развёрнут (Render, Railway,
 * Fly.io и т.п.). Названия и сигнатуры функций совпадают с data.js,
 * поэтому остальной код страниц менять не нужно.
 *
 * Что нужно сделать:
 *   1. Замените API_BASE ниже на адрес вашего сервера.
 *   2. На каждой странице замените
 *        <script src="../assets/js/data.js"></script>
 *      на
 *        <script src="../assets/js/data.remote.js"></script>
 *   3. Добавьте в начало каждой защищённой страницы вызов hydrate(),
 *      чтобы подтянуть текущего пользователя по токену (см. ниже).
 */
const API_BASE = 'https://your-backend.example.com/api';

const DB = (() => {
  let cachedUser = null;

  function request(path, options = {}) {
    const token = localStorage.getItem('rapo_token');
    return fetch(API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...options.headers,
      },
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Ошибка сервера.');
      return body;
    });
  }

  function registerUser(data) {
    return request('/register', { method: 'POST', body: JSON.stringify(data) })
      .then(({ token, user }) => { localStorage.setItem('rapo_token', token); cachedUser = user; return user; });
  }

  function loginUser(data) {
    return request('/login', { method: 'POST', body: JSON.stringify(data) })
      .then(({ token, user }) => { localStorage.setItem('rapo_token', token); cachedUser = user; return user; });
  }

  function logout() {
    localStorage.removeItem('rapo_token');
    cachedUser = null;
  }

  /** Вызовите один раз при загрузке страницы, чтобы восстановить сессию из токена. */
  function hydrate() {
    if (!localStorage.getItem('rapo_token')) return Promise.resolve(null);
    return request('/me').then((user) => { cachedUser = user; return user; }).catch(() => { cachedUser = null; return null; });
  }

  function getCurrentUser() {
    return cachedUser;
  }

  function requireAuth(redirectTo = 'login.html') {
    if (!localStorage.getItem('rapo_token')) {
      window.location.href = redirectTo;
      return null;
    }
    return cachedUser;
  }

  function getAds(params = {}) {
    const qs = params.query ? '?query=' + encodeURIComponent(params.query) : '';
    return request('/ads' + qs);
  }

  function getAdById(id) { return request('/ads/' + encodeURIComponent(id)); }
  function getAdsByUser(userId) { return request('/users/' + encodeURIComponent(userId) + '/ads'); }
  function createAd(data) { return request('/ads', { method: 'POST', body: JSON.stringify(data) }); }
  function deleteAd(id) { return request('/ads/' + encodeURIComponent(id), { method: 'DELETE' }); }

  return { registerUser, loginUser, logout, hydrate, getCurrentUser, requireAuth, getAds, getAdById, getAdsByUser, createAd, deleteAd };
})();
