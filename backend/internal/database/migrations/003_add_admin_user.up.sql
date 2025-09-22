-- Add admin user with bcrypt password hash
-- Password: 123456
INSERT INTO users (username, email, password_hash, role, storage_quota) VALUES 
('admin', 'admin@filevault.com', '$2a$10$h5oaXaw5GeEjHZyO86fd0O9tv8i.fyYuEt2RvKKTYsVkZb5WsHybG', 'ADMIN', 10737418240)
ON CONFLICT (username) DO NOTHING;

