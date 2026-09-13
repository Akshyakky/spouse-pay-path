/*
================================================================================
  Spouse Pay Path - PostgreSQL schema
  Compatible with: PostgreSQL 14+ / Neon / Supabase / Railway / Render
================================================================================
*/

DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS family_dues CASCADE;
DROP TABLE IF EXISTS payment_demands CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS families CASCADE;
DROP TABLE IF EXISTS stored_files CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP SEQUENCE IF EXISTS family_no_seq;
DROP SEQUENCE IF EXISTS voucher_no_seq;

DROP FUNCTION IF EXISTS trg_users_after_insert();
DROP FUNCTION IF EXISTS touch_updated_at();

CREATE SEQUENCE family_no_seq AS INTEGER START WITH 1 INCREMENT BY 1 MINVALUE 1;
CREATE SEQUENCE voucher_no_seq AS INTEGER START WITH 1 INCREMENT BY 1 MINVALUE 1;

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(320) NOT NULL UNIQUE,
    username      VARCHAR(100) NULL,
    full_name     VARCHAR(200) NULL,
    password_hash VARCHAR(255) NULL,
    app_role      VARCHAR(20)  NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_users_app_role CHECK (app_role IS NULL OR app_role IN ('admin', 'family'))
);

CREATE TABLE profiles (
    id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username   VARCHAR(100) NULL UNIQUE,
    full_name  VARCHAR(200) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role),
    CONSTRAINT ck_user_roles_role CHECK (role IN ('admin', 'family'))
);

CREATE TABLE stored_files (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder            VARCHAR(200) NOT NULL,
    original_filename VARCHAR(200) NOT NULL,
    content_type      VARCHAR(120) NOT NULL,
    content           BYTEA NOT NULL,
    byte_length       INTEGER NOT NULL,
    created_by        UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_stored_files_byte_length CHECK (byte_length > 0 AND byte_length <= 10485760)
);

CREATE TABLE families (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_no        VARCHAR(20) NOT NULL UNIQUE
        DEFAULT ('FAM-' || lpad(nextval('family_no_seq')::text, 4, '0')),
    family_name      VARCHAR(200) NOT NULL,
    address          VARCHAR(500) NULL,
    contact_phone    VARCHAR(50) NULL,
    contact_email    VARCHAR(320) NULL,
    family_photo_url VARCHAR(1000) NULL,
    wife_user_id     UUID NULL UNIQUE REFERENCES users(id),
    created_by       UUID NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE family_members (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id      UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    relationship   VARCHAR(40) NOT NULL,
    full_name      VARCHAR(200) NOT NULL,
    gender         VARCHAR(30) NULL,
    date_of_birth  DATE NULL,
    blood_group    VARCHAR(10) NULL,
    contact        VARCHAR(100) NULL,
    address        VARCHAR(500) NULL,
    photo_url      VARCHAR(1000) NULL,
    remarks        VARCHAR(1000) NULL,
    id_card_type   VARCHAR(30) NULL,
    id_card_number VARCHAR(50) NULL,
    is_head        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_family_members_relationship CHECK (relationship IN (
        'wife', 'husband',
        'daughter', 'son',
        'daughter_in_law', 'son_in_law',
        'granddaughter', 'grandson',
        'great_granddaughter', 'great_grandson',
        'other'
    )),
    CONSTRAINT ck_family_members_blood_group CHECK (
        blood_group IS NULL
        OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    ),
    CONSTRAINT ck_family_members_id_card_type CHECK (
        id_card_type IS NULL
        OR id_card_type IN ('aadhaar', 'pan', 'epic', 'dl', 'ration_card')
    )
);

CREATE UNIQUE INDEX uq_family_members_one_head
    ON family_members (family_id)
    WHERE is_head;

CREATE TABLE payment_demands (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             VARCHAR(200) NOT NULL,
    description       VARCHAR(1000) NULL,
    amount_per_family NUMERIC(12, 2) NOT NULL,
    due_date          DATE NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'open',
    created_by        UUID NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_payment_demands_amount CHECK (amount_per_family > 0),
    CONSTRAINT ck_payment_demands_status CHECK (status IN ('open', 'closed'))
);

CREATE TABLE family_dues (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id  UUID NOT NULL REFERENCES payment_demands(id) ON DELETE CASCADE,
    family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    amount_due NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_family_dues_amount CHECK (amount_due > 0),
    CONSTRAINT uq_family_dues_demand_family UNIQUE (demand_id, family_id)
);

CREATE TABLE payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_no     VARCHAR(30) NOT NULL UNIQUE
        DEFAULT (
            'VCH-' || to_char(timezone('utc', now()), 'YYYY') || '-'
            || lpad(nextval('voucher_no_seq')::text, 5, '0')
        ),
    family_id      UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    family_due_id  UUID NULL REFERENCES family_dues(id),
    paid_by        VARCHAR(200) NULL,
    mode           VARCHAR(20) NOT NULL,
    amount         NUMERIC(12, 2) NOT NULL,
    payment_date   DATE NOT NULL DEFAULT (timezone('utc', now()))::date,
    txn_ref        VARCHAR(100) NULL,
    screenshot_url VARCHAR(1000) NULL,
    remarks        VARCHAR(1000) NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    admin_remarks  VARCHAR(1000) NULL,
    approved_by    UUID NULL REFERENCES users(id),
    approved_at    TIMESTAMPTZ NULL,
    created_by     UUID NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_payments_amount CHECK (amount > 0),
    CONSTRAINT ck_payments_mode CHECK (mode IN ('cash', 'online')),
    CONSTRAINT ck_payments_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE TABLE expenses (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category       VARCHAR(100) NOT NULL,
    amount         NUMERIC(12, 2) NOT NULL,
    expense_date   DATE NOT NULL DEFAULT (timezone('utc', now()))::date,
    description    VARCHAR(1000) NULL,
    attachment_url VARCHAR(1000) NULL,
    family_id      UUID NULL REFERENCES families(id) ON DELETE SET NULL,
    created_by     UUID NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_expenses_amount CHECK (amount > 0)
);

CREATE INDEX ix_user_roles_user_id ON user_roles (user_id);
CREATE INDEX ix_user_roles_role ON user_roles (role);
CREATE INDEX ix_stored_files_created_by ON stored_files (created_by);
CREATE INDEX ix_families_created_by ON families (created_by);
CREATE INDEX ix_families_family_name ON families (family_name);
CREATE INDEX ix_family_members_family_id ON family_members (family_id);
CREATE INDEX ix_family_members_relationship ON family_members (relationship);
CREATE INDEX ix_payments_family_id ON payments (family_id);
CREATE INDEX ix_payments_status ON payments (status);
CREATE INDEX ix_payments_payment_date ON payments (payment_date);
CREATE INDEX ix_payments_created_by ON payments (created_by);
CREATE INDEX ix_payments_family_due_id ON payments (family_due_id);
CREATE INDEX ix_family_dues_family_id ON family_dues (family_id);
CREATE INDEX ix_family_dues_demand_id ON family_dues (demand_id);
CREATE INDEX ix_expenses_family_id ON expenses (family_id);
CREATE INDEX ix_expenses_expense_date ON expenses (expense_date);
CREATE INDEX ix_expenses_category ON expenses (category);

CREATE OR REPLACE FUNCTION trg_users_after_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    assigned_role text;
    profile_username text;
BEGIN
    profile_username := COALESCE(
        NULLIF(btrim(NEW.username), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO profiles (id, username, full_name)
    VALUES (NEW.id, profile_username, COALESCE(NEW.full_name, ''))
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.id) THEN
        IF NEW.app_role = 'family' THEN
            assigned_role := 'family';
        ELSIF NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin') THEN
            assigned_role := 'admin';
        ELSE
            assigned_role := 'family';
        END IF;

        INSERT INTO user_roles (user_id, role) VALUES (NEW.id, assigned_role);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_after_insert
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION trg_users_after_insert();

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_families_touch_updated_at
BEFORE UPDATE ON families
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_family_members_touch_updated_at
BEFORE UPDATE ON family_members
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();
