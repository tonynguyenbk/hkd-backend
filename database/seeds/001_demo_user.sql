-- Seed: demo user cho development
-- Chạy: psql $DATABASE_URL -f database/seeds/001_demo_user.sql
-- Password: demo123 (bcrypt hash bên dưới)

INSERT INTO users (email, password_hash, full_name, phone)
VALUES (
  'demo@hkd.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBahQNxHxoGQh6', -- demo123
  'Demo HKD',
  '0900000000'
) ON CONFLICT (email) DO NOTHING;
