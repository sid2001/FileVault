
DROP TABLE IF EXISTS file_downloads;


CREATE TABLE file_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_file_id UUID NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_content_id UUID NOT NULL REFERENCES file_contents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL
);


CREATE INDEX idx_file_downloads_user_id ON file_downloads(user_id);
