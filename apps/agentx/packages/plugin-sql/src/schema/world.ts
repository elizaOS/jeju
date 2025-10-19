import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { agentTable } from './agent';

/**
 * Represents a table schema for worlds in the database.
 *
 * @type {PgTable}
 */

export const worldTable = pgTable('worlds', {
  id: uuid('id')
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agentTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  metadata: jsonb('metadata'),
  serverId: text('server_id').notNull().default('local'),
  createdAt: timestamp('created_at')
    .default(sql`now()`)
    .notNull(),
});
