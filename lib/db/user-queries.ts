import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { user, type User } from './user-schema';

// 通过ID查询用户
export async function getUserById(id: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.id, id));
  } catch (error) {
    console.error('Failed to get user by id from database');
    throw error;
  }
}

// 通过lcUserId查询用户
export async function getUserByLcUserId(
  lcUserId: string,
): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.lcUserId, lcUserId));
  } catch (error) {
    console.error('Failed to get user by lcUserId from database');
    throw error;
  }
}

// 通过lcUserId创建或更新用户，并返回用户对象和创建状态
export async function createOrUpdateUserByLcUserId(
  lcUserId: string,
  avatarUrl: string,
  nickname: string,
  lcSessionToken: string,
): Promise<{ user: User | null; isCreated: boolean }> {
  try {
    const existingUsers = await getUserByLcUserId(lcUserId);

    if (existingUsers.length > 0) {
      // 更新用户
      await db
        .update(user)
        .set({
          avatarUrl,
          nickname,
          lcSessionToken,
        })
        .where(eq(user.lcUserId, lcUserId));

      // 构建更新后的用户对象
      const updatedUser: User = {
        ...existingUsers[0], // 复制现有用户信息
        avatarUrl:
          avatarUrl !== undefined ? avatarUrl : existingUsers[0].avatarUrl,
        nickname: nickname !== undefined ? nickname : existingUsers[0].nickname,
        lcSessionToken:
          lcSessionToken !== undefined
            ? lcSessionToken
            : existingUsers[0].lcSessionToken,
      };

      return { user: updatedUser, isCreated: false };
    } else {
      // 创建用户
      const newUserValues = {
        lcUserId,
        avatarUrl,
        nickname,
        lcSessionToken,
      };

      // 插入用户并获取插入后的记录（包括 id）
      const insertedUsers = await db
        .insert(user)
        .values(newUserValues)
        .returning();

      if (insertedUsers.length > 0) {
        const createdUser: User = insertedUsers[0]; // 获取插入后的用户对象
        return { user: createdUser, isCreated: true };
      } else {
        // 如果插入失败，返回 null 或抛出错误
        return { user: null, isCreated: false };
      }
    }
  } catch (error) {
    console.error(
      'Failed to create or update user by lcUserId in database',
      error,
    );
    throw error;
  }
}
