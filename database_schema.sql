-- Database Schema for GoalPulse
-- Run these statements in the Vercel Postgres query editor to initialize your database.

-- 1. Create Users Table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc') NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc') NOT NULL
);

-- 2. Create Goals Table
CREATE TABLE goals (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'productivity' NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc') NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc') NOT NULL
);

-- 3. Create Checkins Table
CREATE TABLE checkins (
    id VARCHAR(36) PRIMARY KEY,
    goal_id VARCHAR(36) NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response TEXT NOT NULL,
    mood VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc') NOT NULL
);

-- 4. Create Initial User (for the "neo" demo user)
INSERT INTO users (id, email, name, created_at, updated_at)
VALUES ('neo', 'neo@example.com', 'Neo', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
