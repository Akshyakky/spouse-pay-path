-- Payment demands (contribution requests) + per-family dues (idempotent)

IF OBJECT_ID(N'dbo.payment_demands', N'U') IS NULL
BEGIN
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
END
GO

IF OBJECT_ID(N'dbo.family_dues', N'U') IS NULL
BEGIN
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
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_family_dues_family_id'
    AND object_id = OBJECT_ID(N'dbo.family_dues')
)
BEGIN
  CREATE INDEX IX_family_dues_family_id ON dbo.family_dues (family_id);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_family_dues_demand_id'
    AND object_id = OBJECT_ID(N'dbo.family_dues')
)
BEGIN
  CREATE INDEX IX_family_dues_demand_id ON dbo.family_dues (demand_id);
END
GO

IF COL_LENGTH(N'dbo.payments', N'family_due_id') IS NULL
BEGIN
  ALTER TABLE dbo.payments ADD family_due_id UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = N'FK_payments_family_due'
    AND parent_object_id = OBJECT_ID(N'dbo.payments')
)
BEGIN
  ALTER TABLE dbo.payments
    ADD CONSTRAINT FK_payments_family_due
      FOREIGN KEY (family_due_id) REFERENCES dbo.family_dues(id) ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_payments_family_due_id'
    AND object_id = OBJECT_ID(N'dbo.payments')
)
BEGIN
  CREATE INDEX IX_payments_family_due_id ON dbo.payments (family_due_id);
END
GO
