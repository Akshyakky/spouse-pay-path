/*
  Bootstrap admin only. Password hash is a placeholder — run:
    npm run seed:passwords

  Login after that:
    admin@spousepaypath.local / Admin@123
*/

BEGIN;

INSERT INTO users (id, email, username, full_name, password_hash, app_role)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@spousepaypath.local', 'admin', 'System Admin', '<hash-admin>', 'admin');

COMMIT;
