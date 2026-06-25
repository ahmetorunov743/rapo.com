/**
 * RAPO — слой данных (DB)
 * ------------------------------------------------------------------
 * Это "мок"-бэкенд на localStorage: все функции возвращают Promise,
 * как и при настоящем fetch() к серверу. Когда появится реальный
 * backend — подключите вместо этого файла assets/js/data.remote.js
 * (тот же набор функций, но они реально ходят на сервер).
 * См. /server/README.md.
 *
 * ⚠️ Это прототип. Пароли хранятся в localStorage в открытом виде —
 * это НЕ безопасно и допустимо только для локальной демонстрации.
 * На реальном сервере пароли обязаны хэшироваться (bcrypt) и никогда
 * не должны возвращаться клиенту.
 */
const DB = (() => {
  const KEYS = { USERS: 'rapo_users', ADS: 'rapo_ads', SESSION: 'rapo_session' };

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function delay(value) { return new Promise((resolve) => setTimeout(() => resolve(value), 120)); }
  function fail(message) { return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 120)); }
  function publicUser(user) {
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
  }

  function registerUser({ username, email, password }) {
    if (!username || !email || !password) return fail('Заполните все поля.');
    const users = read(KEYS.USERS);
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return fail('Этот email уже зарегистрирован.');
    }
    const user = { id: Date.now().toString(36), username, email, password, createdAt: Date.now() };
    users.push(user);
    write(KEYS.USERS, users);
    localStorage.setItem(KEYS.SESSION, user.id);
    return delay(publicUser(user));
  }

  function loginUser({ email, password }) {
    const users = read(KEYS.USERS);
    const user = users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase() && u.password === password);
    if (!user) return fail('Неверный email или пароль.');
    localStorage.setItem(KEYS.SESSION, user.id);
    return delay(publicUser(user));
  }

  function logout() {
    localStorage.removeItem(KEYS.SESSION);
  }

  function getCurrentUser() {
    const id = localStorage.getItem(KEYS.SESSION);
    if (!id) return null;
    return publicUser(read(KEYS.USERS).find((u) => u.id === id));
  }

  /** Зовите в начале защищённых страниц. Редиректит на логин, если не авторизован. */
  function requireAuth(redirectTo = 'login.html') {
    const user = getCurrentUser();
    if (!user) window.location.href = redirectTo;
    return user;
  }

  function getAds({ query } = {}) {
    let ads = read(KEYS.ADS).slice().sort((a, b) => b.createdAt - a.createdAt);
    if (query) {
      const q = query.toLowerCase();
      ads = ads.filter((ad) => ad.title.toLowerCase().includes(q) || ad.description.toLowerCase().includes(q));
    }
    return delay(ads);
  }

  function getAdById(id) {
    return delay(read(KEYS.ADS).find((a) => a.id === id) || null);
  }

  function getAdsByUser(userId) {
    return delay(read(KEYS.ADS).filter((a) => a.userId === userId).sort((a, b) => b.createdAt - a.createdAt));
  }

  function createAd(data) {
    const user = getCurrentUser();
    if (!user) return fail('Нужно войти в аккаунт.');
    if (!data.title || !data.description) return fail('Укажите заголовок и описание.');
    const ads = read(KEYS.ADS);
    const ad = { id: Date.now().toString(36), userId: user.id, author: user.username, createdAt: Date.now(), ...data };
    ads.push(ad);
    write(KEYS.ADS, ads);
    return delay(ad);
  }

  function deleteAd(id) {
    const user = getCurrentUser();
    const ads = read(KEYS.ADS);
    const ad = ads.find((a) => a.id === id);
    if (!ad) return fail('Объявление не найдено.');
    if (!user || ad.userId !== user.id) return fail('Нет доступа к удалению этого объявления.');
    write(KEYS.ADS, ads.filter((a) => a.id !== id));
    return delay(true);
  }

  return { registerUser, loginUser, logout, getCurrentUser, requireAuth, getAds, getAdById, getAdsByUser, createAd, deleteAd };
})();
