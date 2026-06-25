-- RAPO — схема базы данных (PostgreSQL / MySQL совместимо с минимальными правками)

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(80)  NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,        -- bcrypt-хэш, никогда не открытый текст
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE ads (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(160) NOT NULL,
  description  TEXT NOT NULL,
  price        VARCHAR(80),
  contact      VARCHAR(160),
  photo_url    TEXT,                          -- ссылка на файл в хранилище (S3, Cloudinary и т.п.)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_user_id ON ads(user_id);
CREATE INDEX idx_ads_created_at ON ads(created_at DESC);
