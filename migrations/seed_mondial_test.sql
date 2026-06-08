-- Test data for mondial_inscriptions
-- Run this on your local or dev Neon DB

INSERT INTO mondial_inscriptions (first_name, last_name, date_of_birth, email, phone, country, city, state_us, matchs_vises, opt_in_mur, verification_status, anti_fraud_flags)
VALUES
  ('Arnold',    'Mubuanga',   '1992-03-15', 'arnold@test.com',    '+12145550001', 'USA', 'Houston',      'TX', '["houston","atlanta"]',      true,  'verified', '[]'),
  ('Merveille', 'Kasongo',    '1995-07-22', 'merveille@test.com', '+14045550002', 'USA', 'Atlanta',      'GA', '["atlanta"]',                true,  'verified', '[]'),
  ('Béni',      'Lubambo',    '1990-11-08', 'beni@test.com',      '+12145550003', 'USA', 'Dallas',       'TX', '["houston","guadalajara"]',   false, 'verified', '[]'),
  ('Jonathan',  'Ngoy',       '1998-01-30', 'jonathan@test.com',  '+12125550004', 'USA', 'New York',     'NY', '["houston"]',                true,  'pending',  '[]'),
  ('Sarah',     'Mbuluku',    '1993-05-12', 'sarah@test.com',     '+12025550005', 'USA', 'Washington',   'DC', '["houston","atlanta","guadalajara"]', true, 'verified', '[]'),
  ('Grace',     'Tshilumba',  '1997-09-18', 'grace@test.com',     '+13235550006', 'USA', 'Los Angeles',  'CA', '["houston"]',                false, 'pending',  '[]'),
  ('Dieudonné', 'Kabila',     '1988-12-03', 'dieudonne@test.com', '+13125550007', 'USA', 'Chicago',      'IL', '["atlanta"]',                true,  'flagged',  '["duplicate_phone"]'),
  ('Rachel',    'Ntumba',     '1996-04-25', 'rachel@test.com',    '+13055550008', 'USA', 'Miami',        'FL', '["houston","atlanta"]',       true,  'verified', '[]'),
  ('Christian', 'Kalala',     '1991-08-14', 'christian@test.com', '+12065550009', 'USA', 'Seattle',      'WA', '["guadalajara"]',             false, 'pending',  '[]'),
  ('Esther',    'Mwamba',     '1994-02-07', 'esther@test.com',    '+17135550010', 'USA', 'Houston',      'TX', '["houston","atlanta","guadalajara"]', true, 'verified', '[]')
ON CONFLICT (email) DO NOTHING;

-- Dummy justificatifs for test data (no real files)
INSERT INTO justificatifs_identite (inscription_id, type_document, original_filename, stored_filename, mime_type, size, checksum, status)
SELECT
  id,
  'PASSPORT',
  'passport_test.jpg',
  'test-' || id || '.jpg',
  'image/jpeg',
  512000,
  md5(id::text || 'test'),
  'pending'
FROM mondial_inscriptions
WHERE email LIKE '%@test.com'
ON CONFLICT DO NOTHING;
