-- InkMind MVP — MySQL 8.x
-- 与 backend/.env 中 MYSQL_DATABASE 默认 inkmind 一致，改名时请同步修改此处与配置

CREATE DATABASE IF NOT EXISTS inkmind
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inkmind;

-- 用户（微信登录 + 会员档位）
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wechat_openid VARCHAR(64) NOT NULL,
  wechat_unionid VARCHAR(64) NULL,
  nickname VARCHAR(64) NULL,
  avatar_url VARCHAR(512) NULL,
  phone VARCHAR(32) NULL,
  plan ENUM('free', 'pro') NOT NULL DEFAULT 'free',
  entry_count INT UNSIGNED NOT NULL DEFAULT 0,
  ocr_count_month INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_openid (wechat_openid),
  UNIQUE KEY uk_users_unionid (wechat_unionid)
) ENGINE=InnoDB;

-- 收藏句
-- visibility / published_at / *_count：MVP 可全用默认值；二期广场、点赞、评论可直接用，减少 ALTER
CREATE TABLE entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  source_type ENUM('manual', 'ocr') NOT NULL DEFAULT 'manual',
  source_image_url VARCHAR(512) NULL,
  book_title VARCHAR(255) NULL,
  note VARCHAR(500) NULL,
  visibility ENUM('private', 'public', 'unlisted') NOT NULL DEFAULT 'private',
  published_at DATETIME(3) NULL,
  like_count INT UNSIGNED NOT NULL DEFAULT 0,
  comment_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_entries_user_created (user_id, created_at DESC),
  KEY idx_entries_user_alive (user_id, is_deleted),
  KEY idx_entries_public_feed (visibility, is_deleted, published_at DESC),
  CONSTRAINT fk_entries_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 标签（用户维度）
CREATE TABLE tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(32) NOT NULL,
  slug VARCHAR(32) NULL,
  created_by ENUM('user', 'ai', 'system') NOT NULL DEFAULT 'user',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_tags_user_name (user_id, name),
  KEY idx_tags_user (user_id),
  CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE entry_tags (
  entry_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (entry_id, tag_id),
  CONSTRAINT fk_entry_tags_entry FOREIGN KEY (entry_id) REFERENCES entries (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_entry_tags_tag FOREIGN KEY (tag_id) REFERENCES tags (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- AI 解读（可保留历史；业务层也可只展示最新一条）
CREATE TABLE ai_interpretations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  summary TEXT NOT NULL,
  resonance TEXT NOT NULL,
  reflection_question VARCHAR(500) NOT NULL,
  provider VARCHAR(32) NULL,
  model VARCHAR(64) NULL,
  raw_response JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ai_entry (entry_id),
  KEY idx_ai_user_created (user_id, created_at DESC),
  CONSTRAINT fk_ai_entry FOREIGN KEY (entry_id) REFERENCES entries (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ai_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 分享卡片（可选）
CREATE TABLE share_cards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  template VARCHAR(32) NOT NULL DEFAULT 'default',
  image_url VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_share_entry (entry_id),
  CONSTRAINT fk_share_entry FOREIGN KEY (entry_id) REFERENCES entries (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_share_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 刷新令牌（若启用双令牌）
CREATE TABLE refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_rt_user (user_id),
  KEY idx_rt_expires (expires_at),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
