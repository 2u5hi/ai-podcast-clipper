import { PrismaAdapter } from "@auth/prisma-adapter";
import {
  CredentialsSignin,
  type DefaultSession,
  type NextAuthConfig,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { comparePasswords } from "~/lib/auth";
import { loginSchema } from "~/schemas/auth";

import { db } from "~/server/db";
import { clientIp, LIMITS, rateLimit } from "~/server/rate-limit";

// reaches the login form as `code`, so it can say "too many attempts" instead of "wrong password"
class RateLimitedSignIn extends CredentialsSignin {
  code = "rate_limited";
}

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = clientIp(request.headers);
        const allowed =
          (await rateLimit(`signin:ip:${ip}`, LIMITS.signInPerIp)) &&
          (await rateLimit(`signin:email:${email}`, LIMITS.signInPerEmail));
        if (!allowed) throw new RateLimitedSignIn();

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) return null;

        return user;
      },
    }),
  ],
  session: { strategy: "jwt" },
  adapter: PrismaAdapter(db),
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
