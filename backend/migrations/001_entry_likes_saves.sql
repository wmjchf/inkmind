-- 已有库增量执行：点赞 / 收藏他人公开摘录
-- mysql -u ... -p inkmind < migrations/001_entry_likes_saves.sql

USE inkmind;

CREATE TABLE IF NOT EXISTS entry_likes (
  user_id BIGINT UNSIGNED NOT NULL,
  entry_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, entry_id),
  KEY idx_el_entry (entry_id),
  CONSTRAINT fk_el_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_el_entry FOREIGN KEY (entry_id) REFERENCES entries (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entry_saves (
  user_id BIGINT UNSIGNED NOT NULL,
  entry_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, entry_id),
  KEY idx_es_entry (entry_id),
  CONSTRAINT fk_es_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_es_entry FOREIGN KEY (entry_id) REFERENCES entries (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
