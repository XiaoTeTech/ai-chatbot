import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  uuid,
} from 'drizzle-orm/pg-core';

export const user = pgTable('ChatUser', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  lcUserId: varchar('lcUserId', { length: 64 }),
  avatarUrl: varchar('avatarUrl', { length: 255 }),
  nickname: varchar('nickname', { length: 64 }),
  lcSessionToken: varchar('lcSessionToken', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;
