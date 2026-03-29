CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE hkd_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(50) NOT NULL DEFAULT 'thuong_mai',
  size VARCHAR(20) DEFAULT 'sieu_nho',
  region VARCHAR(20) DEFAULT 'tinh_lon',
  province VARCHAR(100),
  duration VARCHAR(20),
  mst VARCHAR(20),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hkd_user ON hkd_profiles(user_id);

CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hkd_id UUID NOT NULL REFERENCES hkd_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period VARCHAR(10) NOT NULL,
  period_label VARCHAR(20),
  analysis_date DATE DEFAULT CURRENT_DATE,
  score INTEGER NOT NULL DEFAULT 0,
  classification VARCHAR(20),
  input_revenue JSONB NOT NULL DEFAULT '{}',
  input_expenses JSONB NOT NULL DEFAULT '{}',
  input_assets JSONB NOT NULL DEFAULT '{}',
  ratios JSONB NOT NULL DEFAULT '{}',
  summary JSONB NOT NULL DEFAULT '{}',
  ai_analysis TEXT,
  ai_generated_at TIMESTAMPTZ,
  import_source VARCHAR(20) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_analyses_hkd ON analyses(hkd_id);
CREATE INDEX idx_analyses_user ON analyses(user_id);
CREATE INDEX idx_analyses_date ON analyses(analysis_date DESC);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_tokens_user ON refresh_tokens(user_id);

CREATE TABLE report_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hkd_id UUID NOT NULL REFERENCES hkd_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency VARCHAR(20) DEFAULT 'monthly',
  send_day INTEGER DEFAULT 5,
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_hkd_updated
  BEFORE UPDATE ON hkd_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();