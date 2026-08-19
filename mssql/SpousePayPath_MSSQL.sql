/*
================================================================================
  Spouse Pay Path - Microsoft SQL Server Script
  Microsoft SQL Server schema
================================================================================
  Run in SSMS against your target server.
  Compatible with: SQL Server 2016+ / Azure SQL Database

  Contents:
    1. Database (optional)
    2. Sequences
    3. Tables + PKs / FKs / CHECKs / UNIQUEs
    4. Indexes
    5. Helper functions
    6. Triggers (updated_at, new-user profile/role)
    7. Sample data
    8. Verification queries
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/*------------------------------------------------------------------------------
  1. DATABASE (comment out if you already have a DB selected)
------------------------------------------------------------------------------*/
IF DB_ID(N'SpousePayPath') IS NULL
BEGIN
    CREATE DATABASE SpousePayPath;
END
GO

USE SpousePayPath;
GO

/*------------------------------------------------------------------------------
  Drop objects in dependency order (safe re-run)
------------------------------------------------------------------------------*/
IF OBJECT_ID(N'dbo.trg_families_touch_updated_at', N'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_families_touch_updated_at;
IF OBJECT_ID(N'dbo.trg_family_members_touch_updated_at', N'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_family_members_touch_updated_at;
IF OBJECT_ID(N'dbo.trg_users_after_insert', N'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_users_after_insert;
GO

IF OBJECT_ID(N'dbo.fn_has_role', N'FN') IS NOT NULL DROP FUNCTION dbo.fn_has_role;
IF OBJECT_ID(N'dbo.fn_is_family_owner', N'FN') IS NOT NULL DROP FUNCTION dbo.fn_is_family_owner;
GO

IF OBJECT_ID(N'dbo.expenses', N'U') IS NOT NULL DROP TABLE dbo.expenses;
IF OBJECT_ID(N'dbo.payments', N'U') IS NOT NULL DROP TABLE dbo.payments;
IF OBJECT_ID(N'dbo.family_dues', N'U') IS NOT NULL DROP TABLE dbo.family_dues;
IF OBJECT_ID(N'dbo.payment_demands', N'U') IS NOT NULL DROP TABLE dbo.payment_demands;
IF OBJECT_ID(N'dbo.family_members', N'U') IS NOT NULL DROP TABLE dbo.family_members;
IF OBJECT_ID(N'dbo.families', N'U') IS NOT NULL DROP TABLE dbo.families;
IF OBJECT_ID(N'dbo.user_roles', N'U') IS NOT NULL DROP TABLE dbo.user_roles;
IF OBJECT_ID(N'dbo.profiles', N'U') IS NOT NULL DROP TABLE dbo.profiles;
IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL DROP TABLE dbo.users;
GO

IF OBJECT_ID(N'dbo.family_no_seq', N'SO') IS NOT NULL DROP SEQUENCE dbo.family_no_seq;
IF OBJECT_ID(N'dbo.voucher_no_seq', N'SO') IS NOT NULL DROP SEQUENCE dbo.voucher_no_seq;
GO

/*------------------------------------------------------------------------------
  2. SEQUENCES (family_no / voucher_no)
------------------------------------------------------------------------------*/
CREATE SEQUENCE dbo.family_no_seq
    AS INT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO CACHE;
GO

CREATE SEQUENCE dbo.voucher_no_seq
    AS INT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO CACHE;
GO

/*------------------------------------------------------------------------------
  3. TABLES
  Enums are enforced via CHECK constraints.
------------------------------------------------------------------------------*/

-- Auth users
CREATE TABLE dbo.users (
    id               UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_users PRIMARY KEY
        CONSTRAINT DF_users_id DEFAULT NEWSEQUENTIALID(),
    email            NVARCHAR(320)    NOT NULL,
    username         NVARCHAR(100)    NULL,
    full_name        NVARCHAR(200)    NULL,
    password_hash    NVARCHAR(255)    NULL,  -- store your app hash here
    app_role         NVARCHAR(20)     NULL,  -- signup hint: 'admin' | 'family'
    is_active        BIT              NOT NULL
        CONSTRAINT DF_users_is_active DEFAULT (1),
    created_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_users_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_users_email UNIQUE (email),
    CONSTRAINT CK_users_app_role CHECK (app_role IS NULL OR app_role IN (N'admin', N'family'))
);
GO

-- Profiles (1:1 with users)
CREATE TABLE dbo.profiles (
    id               UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_profiles PRIMARY KEY,
    username         NVARCHAR(100)    NULL,
    full_name        NVARCHAR(200)    NULL,
    created_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_profiles_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_profiles_username UNIQUE (username),
    CONSTRAINT FK_profiles_users
        FOREIGN KEY (id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- User roles  (enum app_role: admin | family)
CREATE TABLE dbo.user_roles (
    id               UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_user_roles PRIMARY KEY
        CONSTRAINT DF_user_roles_id DEFAULT NEWSEQUENTIALID(),
    user_id          UNIQUEIDENTIFIER NOT NULL,
    role             NVARCHAR(20)     NOT NULL,
    created_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_user_roles_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_user_roles_user_role UNIQUE (user_id, role),
    CONSTRAINT CK_user_roles_role CHECK (role IN (N'admin', N'family')),
    CONSTRAINT FK_user_roles_users
        FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

-- Families
CREATE TABLE dbo.families (
    id               UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_families PRIMARY KEY
        CONSTRAINT DF_families_id DEFAULT NEWSEQUENTIALID(),
    family_no        NVARCHAR(20)     NOT NULL
        CONSTRAINT DF_families_family_no
            DEFAULT (N'FAM-' + RIGHT(N'0000' + CAST(NEXT VALUE FOR dbo.family_no_seq AS NVARCHAR(10)), 4)),
    family_name      NVARCHAR(200)    NOT NULL,
    address          NVARCHAR(500)    NULL,
    contact_phone    NVARCHAR(50)     NULL,
    contact_email    NVARCHAR(320)    NULL,
    family_photo_url NVARCHAR(1000)   NULL,
    wife_user_id     UNIQUEIDENTIFIER NULL,
    created_by       UNIQUEIDENTIFIER NULL,
    created_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_families_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_families_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_families_family_no UNIQUE (family_no),
    CONSTRAINT UQ_families_wife_user_id UNIQUE (wife_user_id),
    CONSTRAINT FK_families_wife_user
        FOREIGN KEY (wife_user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_families_created_by
        FOREIGN KEY (created_by) REFERENCES dbo.users(id)
);
GO

-- Family members  (enum member_relationship)
CREATE TABLE dbo.family_members (
    id               UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_family_members PRIMARY KEY
        CONSTRAINT DF_family_members_id DEFAULT NEWSEQUENTIALID(),
    family_id        UNIQUEIDENTIFIER NOT NULL,
    relationship     NVARCHAR(40)     NOT NULL,
    full_name        NVARCHAR(200)    NOT NULL,
    gender           NVARCHAR(30)     NULL,
    date_of_birth    DATE             NULL,
    blood_group      NVARCHAR(10)     NULL,
    contact          NVARCHAR(100)    NULL,
    address          NVARCHAR(500)    NULL,
    photo_url        NVARCHAR(1000)   NULL,
    remarks          NVARCHAR(1000)   NULL,
    id_card_type     NVARCHAR(30)     NULL,
    id_card_number   NVARCHAR(50)     NULL,
    is_head          BIT              NOT NULL
        CONSTRAINT DF_family_members_is_head DEFAULT (0),
    created_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_family_members_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_family_members_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_family_members_relationship
        CHECK (relationship IN (
          N'wife', N'husband',
          N'daughter', N'son',
          N'daughter_in_law', N'son_in_law',
          N'granddaughter', N'grandson',
          N'great_granddaughter', N'great_grandson',
          N'other'
        )),
    CONSTRAINT CK_family_members_blood_group
        CHECK (
          blood_group IS NULL
          OR blood_group IN (N'A+', N'A-', N'B+', N'B-', N'AB+', N'AB-', N'O+', N'O-')
        ),
    CONSTRAINT CK_family_members_id_card_type
        CHECK (
          id_card_type IS NULL
          OR id_card_type IN (N'aadhaar', N'pan', N'epic', N'dl', N'ration_card')
        ),
    CONSTRAINT FK_family_members_families
        FOREIGN KEY (family_id) REFERENCES dbo.families(id) ON DELETE CASCADE
);
GO

-- At most one head of family per family
CREATE UNIQUE INDEX UQ_family_members_one_head
    ON dbo.family_members (family_id)
    WHERE is_head = 1;
GO

-- Payment demands (contribution / levy requests)
CREATE TABLE dbo.payment_demands (
    id                 UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_payment_demands PRIMARY KEY
        CONSTRAINT DF_payment_demands_id DEFAULT NEWSEQUENTIALID(),
    title              NVARCHAR(200)    NOT NULL,
    description        NVARCHAR(1000)   NULL,
    amount_per_family  DECIMAL(12,2)    NOT NULL,
    due_date           DATE             NULL,
    status             NVARCHAR(20)     NOT NULL
        CONSTRAINT DF_payment_demands_status DEFAULT (N'open'),
    created_by         UNIQUEIDENTIFIER NULL,
    created_at         DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_payment_demands_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_payment_demands_amount CHECK (amount_per_family > 0),
    CONSTRAINT CK_payment_demands_status CHECK (status IN (N'open', N'closed')),
    CONSTRAINT FK_payment_demands_created_by
        FOREIGN KEY (created_by) REFERENCES dbo.users(id)
);
GO

-- Per-family due for each demand
CREATE TABLE dbo.family_dues (
    id          UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_family_dues PRIMARY KEY
        CONSTRAINT DF_family_dues_id DEFAULT NEWSEQUENTIALID(),
    demand_id   UNIQUEIDENTIFIER NOT NULL,
    family_id   UNIQUEIDENTIFIER NOT NULL,
    amount_due  DECIMAL(12,2)    NOT NULL,
    created_at  DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_family_dues_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_family_dues_amount CHECK (amount_due > 0),
    CONSTRAINT UQ_family_dues_demand_family UNIQUE (demand_id, family_id),
    CONSTRAINT FK_family_dues_demand
        FOREIGN KEY (demand_id) REFERENCES dbo.payment_demands(id) ON DELETE CASCADE,
    CONSTRAINT FK_family_dues_family
        FOREIGN KEY (family_id) REFERENCES dbo.families(id) ON DELETE CASCADE
);
GO

-- Payments  (enums payment_mode, payment_status)
CREATE TABLE dbo.payments (
    id               UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_payments PRIMARY KEY
        CONSTRAINT DF_payments_id DEFAULT NEWSEQUENTIALID(),
    voucher_no       NVARCHAR(30)     NOT NULL
        CONSTRAINT DF_payments_voucher_no
            DEFAULT (
                N'VCH-' + CONVERT(NVARCHAR(4), YEAR(SYSUTCDATETIME())) + N'-'
                + RIGHT(N'00000' + CAST(NEXT VALUE FOR dbo.voucher_no_seq AS NVARCHAR(10)), 5)
            ),
    family_id        UNIQUEIDENTIFIER NOT NULL,
    family_due_id    UNIQUEIDENTIFIER NULL,
    paid_by          NVARCHAR(200)    NULL,
    mode             NVARCHAR(20)     NOT NULL,
    amount           DECIMAL(12,2)    NOT NULL,
    payment_date     DATE             NOT NULL
        CONSTRAINT DF_payments_payment_date DEFAULT (CONVERT(date, SYSUTCDATETIME())),
    txn_ref          NVARCHAR(100)    NULL,
    screenshot_url   NVARCHAR(1000)   NULL,
    remarks          NVARCHAR(1000)   NULL,
    status           NVARCHAR(20)     NOT NULL
        CONSTRAINT DF_payments_status DEFAULT (N'pending'),
    admin_remarks    NVARCHAR(1000)   NULL,
    approved_by      UNIQUEIDENTIFIER NULL,
    approved_at      DATETIMEOFFSET(7) NULL,
    created_by       UNIQUEIDENTIFIER NULL,
    created_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_payments_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_payments_voucher_no UNIQUE (voucher_no),
    CONSTRAINT CK_payments_amount CHECK (amount > 0),
    CONSTRAINT CK_payments_mode CHECK (mode IN (N'cash', N'online')),
    CONSTRAINT CK_payments_status CHECK (status IN (N'pending', N'approved', N'rejected')),
    CONSTRAINT FK_payments_families
        FOREIGN KEY (family_id) REFERENCES dbo.families(id) ON DELETE CASCADE,
    CONSTRAINT FK_payments_family_due
        FOREIGN KEY (family_due_id) REFERENCES dbo.family_dues(id) ON DELETE NO ACTION,
    CONSTRAINT FK_payments_approved_by
        FOREIGN KEY (approved_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_payments_created_by
        FOREIGN KEY (created_by) REFERENCES dbo.users(id)
);
GO

-- Expenses
CREATE TABLE dbo.expenses (
    id               UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_expenses PRIMARY KEY
        CONSTRAINT DF_expenses_id DEFAULT NEWSEQUENTIALID(),
    category         NVARCHAR(100)    NOT NULL,
    amount           DECIMAL(12,2)    NOT NULL,
    expense_date     DATE             NOT NULL
        CONSTRAINT DF_expenses_expense_date DEFAULT (CONVERT(date, SYSUTCDATETIME())),
    description      NVARCHAR(1000)   NULL,
    attachment_url   NVARCHAR(1000)   NULL,
    family_id        UNIQUEIDENTIFIER NULL,
    created_by       UNIQUEIDENTIFIER NULL,
    created_at       DATETIMEOFFSET(7) NOT NULL
        CONSTRAINT DF_expenses_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_expenses_amount CHECK (amount > 0),
    CONSTRAINT FK_expenses_families
        FOREIGN KEY (family_id) REFERENCES dbo.families(id) ON DELETE SET NULL,
    CONSTRAINT FK_expenses_created_by
        FOREIGN KEY (created_by) REFERENCES dbo.users(id)
);
GO

/*------------------------------------------------------------------------------
  4. INDEXES
------------------------------------------------------------------------------*/
CREATE INDEX IX_user_roles_user_id       ON dbo.user_roles (user_id);
CREATE INDEX IX_user_roles_role          ON dbo.user_roles (role);

CREATE INDEX IX_families_created_by      ON dbo.families (created_by);
CREATE INDEX IX_families_family_name     ON dbo.families (family_name);

CREATE INDEX IX_family_members_family_id ON dbo.family_members (family_id);
CREATE INDEX IX_family_members_relationship ON dbo.family_members (relationship);

CREATE INDEX IX_payments_family_id       ON dbo.payments (family_id);
CREATE INDEX IX_payments_status          ON dbo.payments (status);
CREATE INDEX IX_payments_payment_date    ON dbo.payments (payment_date);
CREATE INDEX IX_payments_created_by      ON dbo.payments (created_by);
CREATE INDEX IX_payments_family_due_id   ON dbo.payments (family_due_id);

CREATE INDEX IX_family_dues_family_id    ON dbo.family_dues (family_id);
CREATE INDEX IX_family_dues_demand_id    ON dbo.family_dues (demand_id);

CREATE INDEX IX_expenses_family_id       ON dbo.expenses (family_id);
CREATE INDEX IX_expenses_expense_date    ON dbo.expenses (expense_date);
CREATE INDEX IX_expenses_category        ON dbo.expenses (category);
GO

/*------------------------------------------------------------------------------
  5. HELPER FUNCTIONS
  Role helpers: has_role / is_family_owner
------------------------------------------------------------------------------*/
CREATE FUNCTION dbo.fn_has_role
(
    @_user_id UNIQUEIDENTIFIER,
    @_role    NVARCHAR(20)
)
RETURNS BIT
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM dbo.user_roles
        WHERE user_id = @_user_id
          AND role = @_role
    )
        RETURN 1;
    RETURN 0;
END;
GO

CREATE FUNCTION dbo.fn_is_family_owner
(
    @_family_id UNIQUEIDENTIFIER,
    @_user_id   UNIQUEIDENTIFIER
)
RETURNS BIT
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM dbo.families
        WHERE id = @_family_id
          AND wife_user_id = @_user_id
    )
        RETURN 1;
    RETURN 0;
END;
GO

/*------------------------------------------------------------------------------
  6. TRIGGERS
------------------------------------------------------------------------------*/

-- Auto-create profile + role when a user is inserted
CREATE TRIGGER dbo.trg_users_after_insert
ON dbo.users
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Profile
    INSERT INTO dbo.profiles (id, username, full_name)
    SELECT
        i.id,
        COALESCE(
            NULLIF(LTRIM(RTRIM(i.username)), N''),
            LEFT(i.email, NULLIF(CHARINDEX(N'@', i.email), 0) - 1)
        ),
        COALESCE(i.full_name, N'')
    FROM inserted i
    WHERE NOT EXISTS (SELECT 1 FROM dbo.profiles p WHERE p.id = i.id);

    -- Role: explicit 'family' => family;
    -- otherwise first-ever admin slot => admin; else family
    DECLARE @AdminExists BIT =
        CASE WHEN EXISTS (SELECT 1 FROM dbo.user_roles WHERE role = N'admin') THEN 1 ELSE 0 END;

    DECLARE @c_id UNIQUEIDENTIFIER, @c_role NVARCHAR(20);

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT id, app_role FROM inserted ORDER BY created_at, id;

    OPEN cur;
    FETCH NEXT FROM cur INTO @c_id, @c_role;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.user_roles WHERE user_id = @c_id)
        BEGIN
            IF @c_role = N'family'
            BEGIN
                INSERT INTO dbo.user_roles (user_id, role) VALUES (@c_id, N'family');
            END
            ELSE IF @AdminExists = 0
            BEGIN
                INSERT INTO dbo.user_roles (user_id, role) VALUES (@c_id, N'admin');
                SET @AdminExists = 1;
            END
            ELSE
            BEGIN
                INSERT INTO dbo.user_roles (user_id, role) VALUES (@c_id, N'family');
            END
        END

        FETCH NEXT FROM cur INTO @c_id, @c_role;
    END

    CLOSE cur;
    DEALLOCATE cur;
END;
GO

-- Touch updated_at on families
CREATE TRIGGER dbo.trg_families_touch_updated_at
ON dbo.families
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE f
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.families f
    INNER JOIN inserted i ON i.id = f.id;
END;
GO

-- Touch updated_at on family_members
CREATE TRIGGER dbo.trg_family_members_touch_updated_at
ON dbo.family_members
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE m
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.family_members m
    INNER JOIN inserted i ON i.id = m.id;
END;
GO

/*------------------------------------------------------------------------------
  7. SAMPLE DATA
------------------------------------------------------------------------------*/
BEGIN TRANSACTION;

DECLARE @AdminId   UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @Wife1Id   UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @Wife2Id   UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @Family1Id UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA';
DECLARE @Family2Id UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB';
DECLARE @Pay1Id    UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC';
DECLARE @Pay2Id    UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD';
DECLARE @Pay3Id    UNIQUEIDENTIFIER = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE';
DECLARE @Exp1Id    UNIQUEIDENTIFIER = 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF';
DECLARE @Exp2Id    UNIQUEIDENTIFIER = '12121212-1212-1212-1212-121212121212';

-- Users (profiles + roles created by trigger)
INSERT INTO dbo.users (id, email, username, full_name, password_hash, app_role)
VALUES
    (@AdminId, N'admin@spousepaypath.local', N'admin', N'System Admin', N'<hash-admin>', N'admin'),
    (@Wife1Id, N'priya.sharma@example.com', N'priya', N'Priya Sharma', N'<hash-priya>', N'family'),
    (@Wife2Id, N'anita.patel@example.com', N'anita', N'Anita Patel', N'<hash-anita>', N'family');

-- Families (family_no auto from sequence DEFAULT)
INSERT INTO dbo.families (
    id, family_name, address, contact_phone, contact_email,
    wife_user_id, created_by
)
VALUES
    (@Family1Id, N'Sharma Family',
     N'12 MG Road, Pune, MH 411001', N'+91-98765-43210', N'priya.sharma@example.com',
     @Wife1Id, @AdminId),
    (@Family2Id, N'Patel Family',
     N'45 Ring Road, Ahmedabad, GJ 380015', N'+91-91234-56789', N'anita.patel@example.com',
     @Wife2Id, @AdminId);

-- Family members
INSERT INTO dbo.family_members (
    family_id, relationship, full_name, gender, date_of_birth, contact, remarks,
    id_card_type, id_card_number, is_head
)
VALUES
    (@Family1Id, N'wife',     N'Priya Sharma',   N'Female', '1990-05-14', N'+91-98765-43210', NULL, N'aadhaar', N'1234-5678-9012', 0),
    (@Family1Id, N'husband',  N'Rahul Sharma',   N'Male',   '1988-11-02', N'+91-98765-43211', NULL, N'pan', N'ABCDE1234F', 1),
    (@Family1Id, N'daughter', N'Aanya Sharma',   N'Female', '2015-03-21', NULL, N'School grade 5', N'aadhaar', N'2345-6789-0123', 0),
    (@Family1Id, N'son',      N'Arjun Sharma',   N'Male',   '2018-08-09', NULL, NULL, N'aadhaar', N'3456-7890-1234', 0),
    (@Family2Id, N'wife',     N'Anita Patel',    N'Female', '1992-01-30', N'+91-91234-56789', NULL, N'epic', N'ABC1234567', 0),
    (@Family2Id, N'husband',  N'Vikram Patel',   N'Male',   '1989-07-18', N'+91-91234-56780', NULL, N'dl', N'MH14-20190012345', 1),
    (@Family2Id, N'other',    N'Meera Patel',    N'Female', '1965-04-12', NULL, N'Mother-in-law', N'ration_card', N'RJ-RAT-998877', 0);

-- Payments (voucher_no auto from sequence DEFAULT)
INSERT INTO dbo.payments (
    id, family_id, paid_by, mode, amount, payment_date,
    txn_ref, remarks, status, admin_remarks, approved_by, approved_at, created_by
)
VALUES
    (@Pay1Id, @Family1Id, N'Priya Sharma', N'online', 5000.00, '2026-07-15',
     N'UPI-TXN-1001', N'July contribution', N'approved', N'OK', @AdminId, SYSUTCDATETIME(), @Wife1Id),
    (@Pay2Id, @Family1Id, N'Rahul Sharma', N'cash', 2500.00, '2026-08-01',
     NULL, N'August advance', N'pending', NULL, NULL, NULL, @Wife1Id),
    (@Pay3Id, @Family2Id, N'Anita Patel', N'online', 7500.00, '2026-07-20',
     N'NEFT-88221', N'Q2 family fund', N'rejected', N'Duplicate txn ref', @AdminId, SYSUTCDATETIME(), @Wife2Id);

-- Expenses
INSERT INTO dbo.expenses (
    id, category, amount, expense_date, description, family_id, created_by
)
VALUES
    (@Exp1Id, N'Utilities', 1200.00, '2026-07-10', N'Community hall electricity', NULL, @AdminId),
    (@Exp2Id, N'Events',    3500.00, '2026-07-25', N'Sharma family function support', @Family1Id, @AdminId);

COMMIT TRANSACTION;
GO

/*------------------------------------------------------------------------------
  8. QUICK VERIFICATION
------------------------------------------------------------------------------*/
SELECT N'users' AS [table_name], COUNT(*) AS [row_count] FROM dbo.users
UNION ALL SELECT N'profiles', COUNT(*) FROM dbo.profiles
UNION ALL SELECT N'user_roles', COUNT(*) FROM dbo.user_roles
UNION ALL SELECT N'families', COUNT(*) FROM dbo.families
UNION ALL SELECT N'family_members', COUNT(*) FROM dbo.family_members
UNION ALL SELECT N'payments', COUNT(*) FROM dbo.payments
UNION ALL SELECT N'expenses', COUNT(*) FROM dbo.expenses;

SELECT family_no, family_name, contact_email FROM dbo.families ORDER BY family_no;
SELECT voucher_no, paid_by, amount, status FROM dbo.payments ORDER BY voucher_no;
SELECT u.email, ur.role FROM dbo.users u
INNER JOIN dbo.user_roles ur ON ur.user_id = u.id
ORDER BY ur.role, u.email;
GO

PRINT N'SpousePayPath MS SQL Server script completed successfully.';
GO
