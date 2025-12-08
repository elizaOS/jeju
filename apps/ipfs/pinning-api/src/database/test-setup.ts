/**
 * Test database setup
 * Creates a test database and runs migrations
 */

import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import migrate from './migrate';

const TEST_DB_NAME = 'jeju_ipfs_test';
const ADMIN_CONNECTION = process.env.ADMIN_DATABASE_URL || 'postgresql://localhost:5432/postgres';

export async function setupTestDatabase() {
  const adminClient = postgres(ADMIN_CONNECTION, { max: 1 });
  
  await adminClient.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  await adminClient.unsafe(`CREATE DATABASE ${TEST_DB_NAME}`);
  
  await adminClient.end();
  
  process.env.DATABASE_URL = `postgresql://localhost:5432/${TEST_DB_NAME}`;
  
  await migrate();
  
  console.log('✅ Test database setup complete');
}

export async function teardownTestDatabase() {
  const adminClient = postgres(ADMIN_CONNECTION, { max: 1 });
  
  await adminClient.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  await adminClient.end();
  console.log('✅ Test database cleaned up');
}

