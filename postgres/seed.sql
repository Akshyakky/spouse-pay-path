/*
  Bootstrap admin only. Password hash is a placeholder — run:
    npm run seed:passwords

  Login after that:
    admin@spousepaypath.local / Admin@123
*/

BEGIN;

INSERT INTO users (email, username, full_name, password_hash, app_role)
VALUES
    ('admin@spousepaypath.local', 'admin', 'System Admin', '<hash-admin>', 'admin');

COMMIT;
