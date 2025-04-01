import { createOrUpdateUserByLcUserId } from '@/lib/db/queries';
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
        phone: { label: "Phone", type: "text" },
        code: { label: "Code", type: "text" }
      },
      async authorize(credentials): Promise<ExtendedUser | null> {
        console.log('=== 开始认证流程 ===');
        const { phone, code } = credentials as { phone: string, code: string };
        console.log('收到认证请求:', { phone });

        try {
          const response = await fetch('https://lcen.xiaote.net/api/graphql/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'app-platform': 'web',
              'app-version': '0.0.1'
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
              }`
            })
          });

          const data = await response.json();
          console.log('认证响应:', data);

          if (!data.data?.loginBySms?.sessionToken) {
            console.log('认证失败: 未获取到 sessionToken');
            return null;
          }

          const lcUserId = data.data.loginBySms.user.objectId;
          const nickname = data.data.loginBySms.user.nickname;
          const avatarUrl = data.data.loginBySms.user.avatarUrl;
          const lcSessionToken = data.data.loginBySms.sessionToken;

          console.log('创建或更新用户...');
          const { user } = await createOrUpdateUserByLcUserId(lcUserId, avatarUrl, nickname, lcSessionToken);
          console.log('用户创建/更新结果:', user);

          const userData = {
            id: user?.id,
            name: user?.nickname,
            image: user?.avatarUrl,
            lcSessionToken: user?.lcSessionToken
          };
          console.log('返回用户数据:', userData);
          return userData;
        } catch (error) {
          console.error('认证过程出错:', error);
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
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      console.log('=== JWT Callback ===');
      console.log('Token:', token);
      console.log('User:', user);
      
      if (user) {
        const extendedUser = user as ExtendedUser;
        token.id = extendedUser.id;
        token.name = extendedUser.name;
        if (extendedUser.lcSessionToken){
          token.lcSessionToken = extendedUser.lcSessionToken;
        }
        token.picture = extendedUser.image;
      }
      console.log('返回的 Token:', token);
      return token as ExtendedToken;
    },
    async session({ session, token }: { session: ExtendedSession; token: ExtendedToken }) {
      console.log('=== Session Callback ===');
      console.log('Session:', session);
      console.log('Token:', token);
      
      if (session.user){
        session.user.id = token.id;
        if (token.lcSessionToken){
          session.user.lcSessionToken = token.lcSessionToken;
        }
      }
      console.log('返回的 Session:', session);
      return session;
    },
  },
});    
