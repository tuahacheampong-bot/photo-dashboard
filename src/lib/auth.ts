import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import getDb from '@/lib/db';
import type { User, UserRole } from '@/lib/types';

interface UserWithRole extends User {
  role: UserRole;
}

interface TokenWithRole {
  role?: UserRole;
  id?: string;
}

interface SessionUser {
  name?: string | null;
  email?: string | null;
  role?: UserRole;
  id?: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(
          credentials.email as string
        ) as UserWithRole | null;

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as TokenWithRole).role = (user as { role?: UserRole }).role;
        (token as TokenWithRole).id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser).role = (token as TokenWithRole).role;
        (session.user as SessionUser).id = (token as TokenWithRole).id;
      }
      return session;
    },
  },
});
