-- ============================================================
-- DriveConnect NC - Migration SQL pour Supabase
-- Exécuter dans Supabase → SQL Editor → New Query
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE USERS (élèves et moniteurs)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name        TEXT NOT NULL,
  user_type   TEXT NOT NULL CHECK (user_type IN ('student', 'instructor')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE INSTRUCTORS (profil étendu des moniteurs)
-- ============================================================
CREATE TABLE IF NOT EXISTS instructors (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating           NUMERIC(3,2) DEFAULT 0,
  total_reviews    INT DEFAULT 0,
  experience       INT DEFAULT 0,
  location         TEXT DEFAULT 'Nouméa',
  hourly_rate      INT DEFAULT 4500,
  phone_number     TEXT DEFAULT '',
  verified         BOOLEAN DEFAULT FALSE,
  is_online        BOOLEAN DEFAULT FALSE,
  lat              NUMERIC(10,7) DEFAULT -22.2758,
  lng              NUMERIC(10,7) DEFAULT 166.4580,
  penalty_until    TIMESTAMPTZ,
  visibility_penalty INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE SLOTS (créneaux disponibles)
-- ============================================================
CREATE TABLE IF NOT EXISTS slots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id   UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  time            TEXT NOT NULL,
  duration        NUMERIC(3,1) DEFAULT 1,
  price           INT NOT NULL,
  available       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE BOOKINGS (réservations)
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id           UUID NOT NULL REFERENCES slots(id),
  student_id        UUID NOT NULL REFERENCES users(id),
  instructor_id     UUID NOT NULL REFERENCES instructors(id),
  date              DATE NOT NULL,
  time              TEXT NOT NULL,
  duration          NUMERIC(3,1),
  amount            INT NOT NULL,
  commission        INT DEFAULT 0,
  net               INT DEFAULT 0,
  status            TEXT DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  payment_status    TEXT DEFAULT 'paid' CHECK (payment_status IN ('pending','paid','refunded')),
  paypal_order_id   TEXT,
  cancelled_by      TEXT CHECK (cancelled_by IN ('student','instructor')),
  refund_amount     INT DEFAULT 0,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEX pour performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_slots_instructor ON slots(instructor_id);
CREATE INDEX IF NOT EXISTS idx_slots_date ON slots(date);
CREATE INDEX IF NOT EXISTS idx_slots_available ON slots(available);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_instructor ON bookings(instructor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);

-- ============================================================
-- TRIGGER: mise à jour automatique de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER instructors_updated_at
  BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (sécurité supplémentaire)
-- On utilise la service_key côté backend, donc RLS en lecture seule publique
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Politique: le backend avec service_key contourne RLS (bypass)
-- Les lectures publiques sont gérées côté API

-- ============================================================
-- DONNÉES DE DÉMONSTRATION (moniteurs démo)
-- ============================================================
DO $$
DECLARE
  u1 UUID; u2 UUID; u3 UUID;
  i1 UUID; i2 UUID; i3 UUID;
  slot_date DATE;
  d INT;
BEGIN
  -- Insérer les utilisateurs démo (mot de passe: "demo1234")
  INSERT INTO users (email, password_hash, name, user_type) VALUES
    ('sophie@demo.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyBAphDwkCqm2G', 'Sophie Martin', 'instructor'),
    ('thomas@demo.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyBAphDwkCqm2G', 'Thomas Lebrun', 'instructor'),
    ('marie@demo.com',  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyBAphDwkCqm2G', 'Marie Dubois', 'instructor')
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO u1;

  SELECT id INTO u1 FROM users WHERE email='sophie@demo.com';
  SELECT id INTO u2 FROM users WHERE email='thomas@demo.com';
  SELECT id INTO u3 FROM users WHERE email='marie@demo.com';

  -- Insérer les profils moniteurs
  INSERT INTO instructors (user_id, rating, total_reviews, experience, location, hourly_rate, phone_number, verified, is_online, lat, lng)
  VALUES
    (u1, 4.8, 127, 8,  'Centre-ville',     4500, '+687 12 34 56', true, true,  -22.2758, 166.4580),
    (u2, 4.9, 203, 12, 'Baie des Citrons', 5000, '+687 23 45 67', true, true,  -22.2891, 166.4742),
    (u3, 4.7, 89,  5,  'Magenta',          4200, '+687 34 56 78', true, false, -22.2612, 166.4432)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO i1 FROM instructors WHERE user_id=u1;
  SELECT id INTO i2 FROM instructors WHERE user_id=u2;
  SELECT id INTO i3 FROM instructors WHERE user_id=u3;

  -- Créneaux pour les 7 prochains jours
  FOR d IN 0..6 LOOP
    slot_date := CURRENT_DATE + d;
    INSERT INTO slots (instructor_id, date, time, duration, price) VALUES
      (i1, slot_date, '08:00', 1, 4500), (i1, slot_date, '09:30', 1, 4500),
      (i1, slot_date, '11:00', 1, 4500), (i1, slot_date, '14:00', 1, 4500),
      (i1, slot_date, '15:30', 1, 4500), (i1, slot_date, '17:00', 1, 4500),
      (i2, slot_date, '08:00', 1, 5000), (i2, slot_date, '09:30', 1, 5000),
      (i2, slot_date, '11:00', 1, 5000), (i2, slot_date, '14:00', 1, 5000),
      (i2, slot_date, '15:30', 1, 5000), (i2, slot_date, '17:00', 1, 5000),
      (i3, slot_date, '08:00', 1, 4200), (i3, slot_date, '09:30', 1, 4200),
      (i3, slot_date, '11:00', 1, 4200), (i3, slot_date, '14:00', 1, 4200),
      (i3, slot_date, '15:30', 1, 4200), (i3, slot_date, '17:00', 1, 4200);
  END LOOP;
END $$;

-- Vérification
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL SELECT 'instructors', COUNT(*) FROM instructors
UNION ALL SELECT 'slots', COUNT(*) FROM slots;
