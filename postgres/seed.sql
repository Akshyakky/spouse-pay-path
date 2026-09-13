/*
  Sample data. Password hashes are placeholders — run:
    npm run seed:passwords
  Demo logins after that:
    admin@spousepaypath.local / Admin@123
    priya / Family@123
    anita / Family@123
*/

BEGIN;

INSERT INTO users (id, email, username, full_name, password_hash, app_role)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@spousepaypath.local', 'admin', 'System Admin', '<hash-admin>', 'admin'),
    ('22222222-2222-2222-2222-222222222222', 'priya.sharma@example.com', 'priya', 'Priya Sharma', '<hash-priya>', 'family'),
    ('33333333-3333-3333-3333-333333333333', 'anita.patel@example.com', 'anita', 'Anita Patel', '<hash-anita>', 'family');

INSERT INTO families (
    id, family_name, address, contact_phone, contact_email,
    wife_user_id, created_by
)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sharma Family',
     '12 MG Road, Pune, MH 411001', '+91-98765-43210', 'priya.sharma@example.com',
     '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Patel Family',
     '45 Ring Road, Ahmedabad, GJ 380015', '+91-91234-56789', 'anita.patel@example.com',
     '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');

INSERT INTO family_members (
    family_id, relationship, full_name, gender, date_of_birth, contact, remarks,
    id_card_type, id_card_number, is_head
)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'wife',     'Priya Sharma',  'Female', '1990-05-14', '+91-98765-43210', NULL, 'aadhaar', '1234-5678-9012', FALSE),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'husband',  'Rahul Sharma',  'Male',   '1988-11-02', '+91-98765-43211', NULL, 'pan', 'ABCDE1234F', TRUE),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'daughter', 'Aanya Sharma',  'Female', '2015-03-21', NULL, 'School grade 5', 'aadhaar', '2345-6789-0123', FALSE),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'son',      'Arjun Sharma',  'Male',   '2018-08-09', NULL, NULL, 'aadhaar', '3456-7890-1234', FALSE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'wife',     'Anita Patel',   'Female', '1992-01-30', '+91-91234-56789', NULL, 'epic', 'ABC1234567', FALSE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'husband',  'Vikram Patel',  'Male',   '1989-07-18', '+91-91234-56780', NULL, 'dl', 'MH14-20190012345', TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other',    'Meera Patel',   'Female', '1965-04-12', NULL, 'Mother-in-law', 'ration_card', 'RJ-RAT-998877', FALSE);

INSERT INTO payments (
    id, family_id, paid_by, mode, amount, payment_date,
    txn_ref, remarks, status, admin_remarks, approved_by, approved_at, created_by
)
VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Priya Sharma', 'online', 5000.00, '2026-07-15',
     'UPI-TXN-1001', 'July contribution', 'approved', 'OK', '11111111-1111-1111-1111-111111111111', now(), '22222222-2222-2222-2222-222222222222'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rahul Sharma', 'cash', 2500.00, '2026-08-01',
     NULL, 'August advance', 'pending', NULL, NULL, NULL, '22222222-2222-2222-2222-222222222222'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Anita Patel', 'online', 7500.00, '2026-07-20',
     'NEFT-88221', 'Q2 family fund', 'rejected', 'Duplicate txn ref', '11111111-1111-1111-1111-111111111111', now(), '33333333-3333-3333-3333-333333333333');

INSERT INTO expenses (
    id, category, amount, expense_date, description, family_id, created_by
)
VALUES
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Utilities', 1200.00, '2026-07-10', 'Community hall electricity', NULL, '11111111-1111-1111-1111-111111111111'),
    ('12121212-1212-1212-1212-121212121212', 'Events',    3500.00, '2026-07-25', 'Sharma family function support', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');

COMMIT;
