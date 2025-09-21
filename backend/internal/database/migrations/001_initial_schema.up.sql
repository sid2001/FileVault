CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
CREATE TYPE share_type AS ENUM ('PUBLIC', 'PRIVATE', 'USER_SPECIFIC');
CREATE TYPE audit_action AS ENUM ('UPLOAD', 'DOWNLOAD', 'DELETE', 'SHARE', 'UNSHARE');
CREATE TYPE share_period AS ENUM ('PERMANENT', 'TEMPORARY');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  storage_quota BIGINT NOT NULL DEFAULT 1024 * 1024 * 1024,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE file_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sha256_hash VARCHAR(64) NOT NULL UNIQUE,
  file_path VARCHAR(500) NOT NULL,
  size BIGINT NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  reference_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_content_id UUID NOT NULL REFERENCES file_contents(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  download_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- to calculate storage occupied just divide the size by number of references 
-- there has to be way to recalculate this value for others as well when reference count changes
-- or queue a job to recalculate this value for all users
-- or create a table that will store changes to file refrences and then queue a job to recalculate this value and update related user table storage quota
-- do it at the end of every day

-- CREATE TABLE reference_changes (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   file_content_id UUID NOT NULL REFERENCES file_contents(id) ON DELETE CASCADE,
--   reference_count INTEGER NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- )

-- schedule a task
-- to calculate storage occupied just divide the size by number of references 
-- there has to be way to recalculate this value for others as well when reference count changes
-- create a trigger for reference changes



CREATE TABLE file_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  share_type share_type NOT NULL DEFAULT 'PUBLIC',
  share_period share_period NOT NULL DEFAULT 'PERMANENT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action audit_action NOT NULL,
  file_id UUID REFERENCES user_files(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);




CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_file_contents_hash ON file_contents(sha256_hash);
CREATE INDEX idx_user_files_user_id ON user_files(user_id);
CREATE INDEX idx_user_files_file_content_id ON user_files(file_content_id);
CREATE INDEX idx_user_files_folder_id ON user_files(folder_id);
CREATE INDEX idx_user_files_is_public ON user_files(is_public);
CREATE INDEX idx_user_files_created_at ON user_files(created_at);
CREATE INDEX idx_user_files_tags ON user_files USING gin(tags);
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_parent_folder_id ON folders(parent_folder_id);
CREATE INDEX idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX idx_file_shares_shared_with_user_id ON file_shares(shared_with_user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_file_id ON audit_logs(file_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);



CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';


CREATE OR REPLACE FUNCTION update_storage_quota()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users u
  SET storage_quota = 
    storage_quota - 
    CASE 
      WHEN OLD.reference_count = 0 THEN 0 
      ELSE OLD.size / OLD.reference_count 
    END + 
    CASE
      WHEN NEW.reference_count = 0 THEN NEW.size
      ELSE NEW.size / NEW.reference_count
    END
  WHERE u.id IN (
    SELECT user_id
    FROM user_files
    WHERE file_content_id = NEW.id
  );

  RETURN NEW;
END;
$$ language 'plpgsql';


CREATE TRIGGER update_storage_quota 
AFTER UPDATE OF reference_count ON file_contents
FOR EACH ROW
WHEN (OLD.reference_count IS DISTINCT FROM NEW.reference_count)
EXECUTE FUNCTION update_storage_quota();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_files_updated_at BEFORE UPDATE ON user_files
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_file_shares_updated_at BEFORE UPDATE ON file_shares
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO users (username, email, password_hash, role) VALUES 
('admin_sisa', 'sidharth2001.lumia@gmail.com', '025734a9cec75ec4ccc0776394875699bc9b5d75bb6831443d4d4bf025bb89a5', 'ADMIN');