-- Create users table for authentication
-- Run this migration on SQL Server

-- Create users table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(50) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(20) NOT NULL DEFAULT 'viewer',
        team NVARCHAR(50),
        display_name NVARCHAR(100),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        last_login DATETIME2,
        is_active BIT DEFAULT 1
    );

    -- Create index on username for faster lookups
    CREATE INDEX idx_users_username ON users(username);
    CREATE INDEX idx_users_role ON users(role);
    CREATE INDEX idx_users_team ON users(team);
    CREATE INDEX idx_users_is_active ON users(is_active);

    PRINT 'Users table created successfully';
END
ELSE
BEGIN
    PRINT 'Users table already exists';
END
GO

-- Insert default admin users
-- Password: admin123 (bcrypt hash)
-- Note: These hashes should be generated at runtime for security

-- Check if users exist before inserting
IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'hasif')
BEGIN
    INSERT INTO users (username, password_hash, role, team, display_name, is_active)
    VALUES ('hasif', '$2b$10$placeholder', 'admin', 'data-science', 'Hasif', 1);
END

IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'nazierul')
BEGIN
    INSERT INTO users (username, password_hash, role, team, display_name, is_active)
    VALUES ('nazierul', '$2b$10$placeholder', 'admin', 'data-science', 'Nazierul', 1);
END

IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'izhar')
BEGIN
    INSERT INTO users (username, password_hash, role, team, display_name, is_active)
    VALUES ('izhar', '$2b$10$placeholder', 'editor', 'data-science', 'Izhar', 1);
END

IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'asyraff')
BEGIN
    INSERT INTO users (username, password_hash, role, team, display_name, is_active)
    VALUES ('asyraff', '$2b$10$placeholder', 'editor', 'data-science', 'Asyraff', 1);
END

IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'bob')
BEGIN
    INSERT INTO users (username, password_hash, role, team, display_name, is_active)
    VALUES ('bob', '$2b$10$placeholder', 'editor', 'business-intelligence', 'Bob', 1);
END

IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'yee-ming')
BEGIN
    INSERT INTO users (username, password_hash, role, team, display_name, is_active)
    VALUES ('yee-ming', '$2b$10$placeholder', 'editor', 'business-intelligence', 'Yee Ming', 1);
END

IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'ernie')
BEGIN
    INSERT INTO users (username, password_hash, role, team, display_name, is_active)
    VALUES ('ernie', '$2b$10$placeholder', 'viewer', 'business-intelligence', 'Ernie', 1);
END

PRINT 'Default users inserted (password hashes need to be updated)';
GO
