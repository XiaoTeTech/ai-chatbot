import { createOrUpdateUserByLcUserId } from '@/lib/db/user-queries';
import NextAuth, { type Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';

export interface ExtendedUser {
  id?: string;
  name?: string | null;
  image?: string | null;
  lcSessionToken?: string | null;
}

interface ExtendedSession extends Session {
  user: ExtendedUser;
}

interface ExtendedToken extends JWT {
  id?: string;
  name?: string | null;
  picture?: string | null;
  lcSessionToken?: string | null;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials): Promise<ExtendedUser | null> {
        const { phone, code } = credentials as { phone: string; code: string };

        try {
          const response = await fetch('https://lcen.xiaote.net/api/graphql/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'app-platform': 'web',
              'app-version': '0.0.1',
            },
            body: JSON.stringify({
              query: `mutation {
                loginBySms(mobilePhoneNumber: "${phone}", smsCode: "${code}") {
                  sessionToken
                  user {
                    objectId
                    nickname
                    avatarUrl
                  }
                }
              }`,
            }),
          });

          const data = await response.json();

          if (!data.data?.loginBySms?.sessionToken) {
            return null;
          }

          const lcUserId = data.data.loginBySms.user.objectId;
          const nickname = data.data.loginBySms.user.nickname;
          const avatarUrl = data.data.loginBySms.user.avatarUrl;
          const lcSessionToken = data.data.loginBySms.sessionToken;

          console.log('创建或更新用户...');
          const { user } = await createOrUpdateUserByLcUserId(
            lcUserId,
            avatarUrl,
            nickname,
            lcSessionToken,
          );
          console.log('用户创建/更新结果:', user);

          const userData = {
            id: user?.id,
            name: user?.nickname,
            image: user?.avatarUrl,
            lcSessionToken: user?.lcSessionToken,
          };
          return userData;
        } catch (error) {
          return null;
        }
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  debug: true,
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60, // 365 days (1 year) - effectively never expires unless manually logged out
    updateAge: 24 * 60 * 60, // Update session every 24 hours to keep it fresh
  },
  jwt: {
    maxAge: 365 * 24 * 60 * 60, // JWT token also lasts 1 year
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 365 * 24 * 60 * 60, // Cookie also expires in 1 year
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const extendedUser = user as ExtendedUser;
        token.id = extendedUser.id;
        token.name = extendedUser.name;
        if (extendedUser.lcSessionToken) {
          token.lcSessionToken = extendedUser.lcSessionToken;
        }
        token.picture = extendedUser.image;
      }
      return token as ExtendedToken;
    },
    async session({
      session,
      token,
    }: { session: ExtendedSession; token: ExtendedToken }) {
      if (session.user) {
        session.user.id = token.id;
        if (token.lcSessionToken) {
          session.user.lcSessionToken = token.lcSessionToken;
        }
      }
      return session;
    },
  },
});
