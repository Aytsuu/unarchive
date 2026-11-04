
# Authentication Feature Implementation — Next.js + Better Auth + MongoDB

## 1. Overview

Implement a complete authentication system using Better Auth, Next.js, and MongoDB.

This is a fresh implementation. No authentication APIs currently exist.

### Technology Stack

- Framework: Next.js (App Router)
- UI: React
- Backend: Next.js Route Handlers / Server Components
- Database: MongoDB
- Authentication: Better Auth
- Database Adapter: Better Auth MongoDB Adapter
- Email Verification: Better Auth Email OTP Plugin
- Social Authentication: Google OAuth
- Email Delivery: Resend
- Local Database: MongoDB via Docker Compose
- Production Database: MongoDB Atlas
- Deployment: Vercel

### Architecture

```text
Next.js Application
│
├── React Client Components
│   ├── Signup
│   ├── OTP Verification
│   ├── Login
│   └── Dashboard
│
├── Next.js Server
│   ├── Better Auth
│   ├── Route Handlers
│   ├── Server Components
│   └── Authorization
│
├── MongoDB
│   ├── Users
│   ├── Accounts
│   ├── Sessions
│   └── Verification Records
│
└── External Services
    ├── Google OAuth
    └── Resend Email
```

Do not create a separate Express application unless an independent backend is explicitly required.

Better Auth must manage authentication functionality. Application-specific data should remain separate from Better Auth's internal collections.

---

## 2. Authentication Requirements

### 2.1 Signup

Required flow:

```text
Signup Page
    ↓
Enter Email + Password
    ↓
Validate Input
    ↓
Better Auth Email Signup
    ↓
Create Unverified Account
    ↓
Generate and Send 6-Digit OTP
    ↓
OTP Verification Page
    ↓
Verify OTP
    ↓
Mark Email as Verified
    ↓
Redirect to Login
```

Signup form fields:

- Email
- Password
- Confirm Password

Requirements:

- Validate email format.
- Validate password length.
- Validate matching passwords.
- Prevent duplicate accounts.
- Hash passwords using Better Auth.
- Require email verification before login.
- Automatically send an OTP after signup.
- Do not automatically authenticate newly registered users.
- Redirect verified users to the login page.

OTP requirements:

- Six-digit numeric code
- Five-minute expiration
- Maximum three verification attempts
- Single-use verification
- Hashed OTP storage
- OTP rotation on resend
- Resend cooldown
- Backend rate limiting

### 2.2 Email and Password Login

Required flow:

```text
Login Page
    ↓
Enter Email + Password
    ↓
Better Auth Credential Validation
    ↓
Check Email Verification
    ↓
Create Session
    ↓
Redirect to Dashboard
```

Requirements:

- Reject invalid credentials.
- Reject unverified accounts.
- Provide a resend-verification option.
- Persist authentication across refreshes.
- Use secure HTTP-only session cookies.
- Support logout.
- Protect private pages and APIs.

### 2.3 Google OAuth

Required flow:

```text
Login Page
    ↓
Continue with Google
    ↓
Google OAuth
    ↓
Better Auth Callback
    ↓
Find or Create User
    ↓
Create Session
    ↓
Dashboard
```

Requirements:

- Allow new users to register with Google.
- Allow existing linked Google accounts to log in.
- Do not create duplicate identities.
- Disable implicit account linking.
- Allow authenticated users to explicitly link Google.
- Handle OAuth cancellation and errors.

### 2.4 Account Linking

When an existing email/password user attempts Google login using the same email:

- Do not automatically merge the accounts.
- Show an account-linking message.
- Ask the user to log in using their existing credentials.
- Allow the user to connect Google through account settings.
- Preserve the original user identity.

Use:

```javascript
account: {
  accountLinking: {
    enabled: true,
    disableImplicitLinking: true,
  },
}
```

---

## 3. Recommended Project Structure

```text
project/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...all]/
│   │   │       └── route.js
│   │   └── me/
│   │       └── route.js
│   │
│   ├── (auth)/
│   │   ├── signup/
│   │   │   └── page.jsx
│   │   ├── login/
│   │   │   └── page.jsx
│   │   └── verify-email/
│   │       └── page.jsx
│   │
│   ├── (protected)/
│   │   └── dashboard/
│   │       └── page.jsx
│   │
│   └── layout.jsx
│
├── components/
│   └── auth/
│       ├── SignupForm.jsx
│       ├── LoginForm.jsx
│       ├── OTPVerification.jsx
│       └── GoogleLoginButton.jsx
│
├── lib/
│   ├── auth.js
│   ├── auth-client.js
│   ├── mongodb.js
│   └── email.js
│
├── compose.yaml
├── .env
├── .env.local
├── .gitignore
└── package.json
```

Use existing project conventions when available.

Do not restructure unrelated modules.

---

## 4. MongoDB Local Development

Use Docker Compose to run MongoDB locally.

Create `compose.yaml`:

```yaml
services:
  mongodb:
    image: mongo:8
    container_name: nextjs-mongodb
    restart: unless-stopped

    ports:
      - "127.0.0.1:27017:27017"

    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}

    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

Create `.env` for Docker Compose:

```env
MONGO_USER=devuser
MONGO_PASSWORD=replace_with_local_password
```

Start MongoDB:

```bash
docker compose up -d
```

Stop MongoDB:

```bash
docker compose down
```

The Docker named volume must preserve database data between container restarts.

Never use `docker compose down -v` unless deliberately deleting the local database.

---

## 5. Install Dependencies

Install the following packages:

```bash
npm install better-auth @better-auth/mongo-adapter mongodb resend
```

Better Auth integrates directly with Next.js.

Do not install Express, CORS middleware, or a separate authentication server.

---

## 6. Environment Variables

Create `.env.local` in the Next.js project root.

```env
# MongoDB
MONGODB_URI=mongodb://devuser:replace_with_local_password@127.0.0.1:27017/?authSource=admin
MONGODB_DB_NAME=nextjs_app_dev
MONGO_ENABLE_TRANSACTIONS=false

# Better Auth
BETTER_AUTH_SECRET=replace_with_secure_random_secret
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=Your App <auth@your-verified-domain.com>
```

Generate a secure authentication secret:

```bash
openssl rand -base64 32
```

Requirements:

- Never expose server secrets in client components.
- Never use `NEXT_PUBLIC_` for private credentials.
- Never commit environment files.
- Configure production secrets in Vercel.
- Use a separate production MongoDB database.

---

## 7. MongoDB Connection

Create:

`lib/mongodb.js`

```javascript
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not configured");
}

const globalForMongo = globalThis;

if (!globalForMongo._mongoClient) {
  globalForMongo._mongoClient = new MongoClient(uri);
}

export const mongoClient = globalForMongo._mongoClient;

export const db = mongoClient.db(
  process.env.MONGODB_DB_NAME
);
```

Requirements:

- Reuse the MongoDB client across requests within the same runtime.
- Avoid unnecessarily creating new connections.
- Keep MongoDB code server-side.
- Use a standalone local MongoDB instance without transactions.
- Enable transactions in production only with a supported MongoDB deployment.

For production, use MongoDB Atlas.

---

## 8. Email Delivery

Create:

`lib/email.js`

```javascript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  text,
}) {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  });

  if (error) {
    throw new Error("Email delivery failed");
  }
}
```

Requirements:

- Use a verified sender domain.
- Do not expose the email provider API key.
- Do not log verification codes.
- Handle failed delivery.
- Keep email sending server-side.
- Use a supported durable delivery or background-execution mechanism if sending asynchronously.

---

## 9. Better Auth Configuration

Create:

`lib/auth.js`

```javascript
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { emailOTP } from "better-auth/plugins";

import { db, mongoClient } from "./mongodb";
import { sendEmail } from "./email";

const useTransactions =
  process.env.MONGO_ENABLE_TRANSACTIONS === "true";

export const auth = betterAuth({
  database: mongodbAdapter(
    db,
    useTransactions ? { client: mongoClient } : {}
  ),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 8,
  },

  emailVerification: {
    autoSignInAfterVerification: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    enabled: true,
    storage: "database",
  },

  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,

      disableSignUp: true,

      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,

      storeOTP: "hashed",
      resendStrategy: "rotate",

      async sendVerificationOTP({ email, otp, type }) {
        if (type === "email-verification") {
          await sendEmail({
            to: email,
            subject: "Verify your email",
            text: `Your verification code is ${otp}. It expires in 5 minutes.`,
          });
        }
      },
    }),
  ],
});
```

Important:

- Let Better Auth generate and validate OTPs.
- Do not implement manual password hashing.
- Do not implement custom authentication JWTs.
- Do not create custom session collections.
- Do not manually create Better Auth user records.
- Do not add a separate email OTP login flow.
- The email OTP plugin's `disableSignUp` option prevents automatic registration through OTP login; regular email/password signup remains enabled.
- Keep authentication rate limits in persistent storage suitable for Vercel.
- Review email delivery behavior to avoid account-enumeration timing differences.

If using Better Auth methods that set cookies inside Next.js Server Actions, add the `nextCookies` plugin as the last plugin in the array.

For the initial implementation, use the official React client for signup, login, and OTP verification instead.

---

## 10. Better Auth API Route

Create:

`app/api/auth/[...all]/route.js`

```javascript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth);
```

This automatically handles Better Auth endpoints under:

```text
/api/auth/*
```

Including:

```text
POST /api/auth/sign-up/email
POST /api/auth/sign-in/email
POST /api/auth/email-otp/verify-email
POST /api/auth/email-otp/send-verification-otp
POST /api/auth/sign-out
GET  /api/auth/get-session
GET  /api/auth/callback/google
```

These routes are managed by Better Auth.

Do not manually recreate them using Next.js Route Handlers.

---

## 11. Better Auth React Client

Create:

`lib/auth-client.js`

```javascript
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
  ],
});
```

Since the application uses Next.js on a single origin, Better Auth automatically communicates with the same-origin authentication API.

Do not configure a separate frontend API base URL unless the architecture requires it.

---

## 12. Signup Implementation

Create or integrate a signup form.

The form must be a React Client Component:

```javascript
"use client";
```

Fields:

- Email
- Password
- Confirm Password

Validate the input before calling Better Auth.

Example:

```javascript
import { authClient } from "@/lib/auth-client";

const { data, error } = await authClient.signUp.email({
  name: "User",
  email,
  password,
});

if (error) {
  // Display a safe error message.
  return;
}

// Navigate to /verify-email
```

Better Auth requires a name when creating a user.

If the application does not collect a name yet, use a temporary display name and let the user update it later.

Requirements:

- Show loading state.
- Disable submission while pending.
- Handle invalid input.
- Handle duplicate email registration safely.
- Automatically trigger email OTP delivery.
- Redirect to the verification page after signup.
- Preserve the email needed for verification.
- Do not authenticate the user automatically.

Use Next.js `useRouter()` for client-side navigation.

---

## 13. OTP Verification

Create:

`app/(auth)/verify-email/page.jsx`

Use a Client Component to manage:

- Six-digit OTP input
- Form submission
- Loading state
- Verification errors
- Resend OTP button
- Resend cooldown
- Expiration message

Verify OTP:

```javascript
const { data, error } =
  await authClient.emailOtp.verifyEmail({
    email,
    otp,
  });

if (error) {
  // Display verification error.
  return;
}

// Redirect to /login
```

Resend OTP:

```javascript
const { data, error } =
  await authClient.emailOtp.sendVerificationOtp({
    email,
    type: "email-verification",
  });

if (error) {
  // Display a safe error message.
  return;
}
```

Requirements:

- Reject incorrect OTPs.
- Reject expired OTPs.
- Reject already-used OTPs.
- Enforce attempt limits.
- Invalidate previous OTPs when resending.
- Apply server-side rate limits.
- Never trust frontend verification flags.
- Redirect to login after successful verification.

The frontend cooldown improves UX but must not be treated as a security control.

---

## 14. Email and Password Login

Create:

`app/(auth)/login/page.jsx`

Login form fields:

- Email
- Password

Include:

- Login button
- Continue with Google button
- Forgot password link
- Signup link

Example:

```javascript
const { data, error } = await authClient.signIn.email({
  email,
  password,
});

if (error) {
  // Handle invalid credentials or unverified email.
  return;
}

// Navigate to /dashboard
```

Requirements:

- Reject invalid credentials.
- Reject unverified accounts.
- Display safe error messages.
- Handle rate limiting.
- Redirect authenticated users.
- Persist authentication across refreshes.
- Do not store sessions in localStorage.

---

## 15. Google OAuth Setup

Create Google OAuth credentials through Google Cloud Console.

Application type:

```text
Web application
```

Local authorized origin:

```text
http://localhost:3000
```

Local redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

Production redirect URI:

```text
https://your-domain.com/api/auth/callback/google
```

Google login:

```javascript
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/dashboard",
});
```

Requirements:

- Allow Google registration.
- Allow login for already-linked accounts.
- Reject unsafe account merging.
- Handle OAuth errors.
- Handle user cancellation.
- Preserve user identity during account linking.

---

## 16. Explicit Google Account Linking

Account linking must require an authenticated user.

Example:

```javascript
await authClient.linkSocial({
  provider: "google",
  callbackURL: "/settings",
});
```

Required behavior:

1. User logs in using email/password.
2. User opens account settings.
3. User selects "Connect Google".
4. Better Auth initiates Google OAuth.
5. Google account is linked to the current user.
6. The user's existing identity and data remain unchanged.

Do not link accounts using frontend email comparisons.

If an unlinked Google account matches an existing email/password user's email, handle Better Auth's `account_not_linked` error and direct the user to the existing login method.

---

## 17. Session Management

Use Better Auth's built-in session system.

For client-side components:

```javascript
"use client";

import { authClient } from "@/lib/auth-client";

export function UserSession() {
  const {
    data: session,
    isPending,
  } = authClient.useSession();

  if (isPending) {
    return <p>Loading...</p>;
  }

  if (!session) {
    return <p>Not authenticated</p>;
  }

  return <p>{session.user.email}</p>;
}
```

Logout:

```javascript
await authClient.signOut();
```

Requirements:

- Use HTTP-only cookies.
- Use HTTPS in production.
- Support session expiration.
- Support logout and revocation.
- Do not store session credentials in localStorage.
- Validate authentication on the server for protected resources.

---

## 18. Protect Server Components

Next.js Server Components can validate authentication directly.

Example:

`app/(protected)/dashboard/page.jsx`

```javascript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome, {session.user.name}</p>
    </main>
  );
}
```

Requirements:

- Verify the actual session before rendering protected data.
- Redirect unauthenticated users.
- Do not rely only on client-side checks.
- Validate authorization before database queries or mutations.

Next.js Proxy or Middleware may be used for early redirects, but cookie-existence checks alone must never be treated as authorization.

---

## 19. Protect API Route Handlers

Example:

`app/api/me/route.js`

```javascript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return Response.json({
    user: session.user,
  });
}
```

For application-specific mutations:

- Validate the current session.
- Use the authenticated user ID.
- Validate resource ownership.
- Apply permission checks.
- Never trust client-supplied user IDs as authentication.

Return:

- `401` for unauthenticated requests.
- `403` for unauthorized actions.

---

## 20. MongoDB Data Management

Allow Better Auth to manage its authentication collections.

Typical models include:

- user
- account
- session
- verification
- rateLimit

Collection naming depends on adapter and configuration.

Do not manually recreate Better Auth's schemas.

Use separate MongoDB collections for application data.

Example:

```text
users (Better Auth)
    |
    | user.id
    v
profiles
projects
organizations
settings
```

Application-specific records should reference the stable Better Auth user ID.

Do not assume Better Auth user IDs are MongoDB ObjectIds.

Use Mongoose or the MongoDB driver for application data according to existing project conventions.

---

## 21. Security Requirements

### Password Security

- Use Better Auth's password hashing.
- Never store plaintext passwords.
- Never log passwords.
- Enforce a reasonable minimum length.
- Support password managers.
- Avoid unnecessary complexity restrictions.

### OTP Security

- Six-digit OTP.
- Five-minute expiration.
- Maximum three verification attempts.
- Hashed storage.
- Rotate on resend.
- Single-use verification.
- Server-side rate limiting.
- Never expose OTPs in logs or API responses.

### Session Security

- HTTP-only cookies.
- Secure cookies over HTTPS.
- Appropriate SameSite settings.
- Session expiration and revocation.
- Backend authorization checks.
- No custom JWT system unless specifically required.
- Retain Better Auth's built-in origin and CSRF protections.

### OAuth Security

- Keep Google client secrets server-side.
- Use Better Auth's verified provider identity.
- Disable implicit account linking.
- Require authentication for manual linking.
- Validate OAuth callback configuration.

### Deployment Security

- Never expose MongoDB publicly.
- Use environment variables.
- Separate development and production databases.
- Use least-privilege database credentials.
- Use persistent rate-limit storage.
- Do not rely on serverless process memory.
- Avoid logging credentials or verification codes.

---

## 22. Vercel Deployment

Deploy the Next.js application as one Vercel project.

Architecture:

```text
Vercel
│
└── Next.js Application
    │
    ├── React Pages
    ├── Next.js Route Handlers
    ├── Better Auth
    └── Server Components
          │
          ├── MongoDB Atlas
          ├── Google OAuth
          └── Resend
```

A separate Express deployment is not required.

Production environment variables:

```env
MONGODB_URI=your_atlas_connection_string
MONGODB_DB_NAME=nextjs_app_prod
MONGO_ENABLE_TRANSACTIONS=true

BETTER_AUTH_URL=https://your-domain.com
BETTER_AUTH_SECRET=your_production_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=Your App <auth@your-verified-domain.com>
```

Requirements:

1. Deploy Next.js to Vercel.
2. Configure MongoDB Atlas.
3. Configure production environment variables.
4. Configure Google OAuth redirect URI.
5. Verify Resend sender domain.
6. Use HTTPS.
7. Test Better Auth Route Handlers.
8. Test authentication cookies.
9. Test login persistence.
10. Test logout and session revocation.

Do not use Vercel's Edge runtime for MongoDB-backed authentication routes.

Use the Node.js runtime.

---

## 23. Testing Checklist

### Signup

- [ ] User can register with email and password.
- [ ] Invalid email is rejected.
- [ ] Invalid password is rejected.
- [ ] Password mismatch is rejected.
- [ ] Duplicate registration is handled safely.
- [ ] OTP is sent automatically.
- [ ] OTP expires after five minutes.
- [ ] Correct OTP verifies the user.
- [ ] Incorrect OTP is rejected.
- [ ] Reused OTP is rejected.
- [ ] Resending invalidates the previous OTP.
- [ ] Unverified accounts cannot log in.
- [ ] Verified accounts can log in.

### Login

- [ ] Email/password login works.
- [ ] Incorrect password is rejected.
- [ ] Unverified login is rejected.
- [ ] Session persists across refreshes.
- [ ] Logout invalidates the session.
- [ ] Protected routes reject unauthenticated users.

### Google OAuth

- [ ] New Google account can register.
- [ ] Existing linked Google account can log in.
- [ ] OAuth cancellation is handled.
- [ ] Duplicate identities are prevented.
- [ ] Implicit account linking is disabled.
- [ ] Manual linking works.

### Security

- [ ] Passwords are hashed.
- [ ] OTP values are hashed.
- [ ] Session cookies are HTTP-only.
- [ ] Production cookies are secure.
- [ ] CSRF protections remain enabled.
- [ ] Rate limiting works across serverless instances.
- [ ] Protected API routes validate sessions.
- [ ] Secrets are not exposed.
- [ ] No sensitive values are logged.

### Deployment

- [ ] Next.js builds successfully.
- [ ] MongoDB Atlas connection works.
- [ ] Email delivery works.
- [ ] Google OAuth callbacks work.
- [ ] Authentication sessions work on Vercel.
- [ ] Protected pages work after refresh.
- [ ] Logout works in production.

---

## 24. Implementation Phases

### Phase 1: Infrastructure

1. Set up MongoDB Docker Compose.
2. Install Better Auth dependencies.
3. Configure MongoDB connection reuse.
4. Set environment variables.
5. Create the Better Auth configuration.
6. Mount the Next.js authentication route.

### Phase 2: Signup and OTP

1. Configure email/password authentication.
2. Configure Email OTP.
3. Configure Resend.
4. Implement signup form.
5. Implement OTP verification page.
6. Implement resend functionality.
7. Test signup and verification.

### Phase 3: Login and Sessions

1. Implement email/password login.
2. Implement session handling.
3. Implement protected Server Components.
4. Implement protected API Route Handlers.
5. Implement logout.
6. Test session security.

### Phase 4: Google OAuth

1. Configure Google Cloud credentials.
2. Configure Better Auth Google provider.
3. Implement Google login.
4. Disable implicit linking.
5. Implement explicit account linking.
6. Test OAuth flows.

### Phase 5: Deployment

1. Configure MongoDB Atlas.
2. Configure Vercel environment variables.
3. Configure production OAuth callbacks.
4. Deploy Next.js.
5. Test production authentication.
6. Review security and error handling.

---

## 25. Instructions for Coding Agents

Follow these implementation rules:

1. Inspect the existing Next.js project structure before making changes.
2. Assume no authentication APIs currently exist.
3. Use Next.js App Router.
4. Use Better Auth for all authentication operations.
5. Do not introduce Express or a second backend.
6. Do not introduce custom JWT management.
7. Do not implement custom OTP generation or verification.
8. Do not implement custom password hashing.
9. Do not manually duplicate Better Auth schemas.
10. Reuse existing UI components and design conventions.
11. Keep authentication code modular.
12. Keep server credentials isolated from Client Components.
13. Use Server Components and Route Handlers for backend authorization.
14. Preserve existing unrelated functionality.
15. Verify Better Auth methods against the installed version.
16. Add tests for critical security behavior.
17. Ensure deployment compatibility with Vercel.
18. Avoid unnecessary abstractions and overengineering.

### Final Required User Experience

**Signup**

```text
Email + Password
    ↓
Receive OTP
    ↓
Verify Email
    ↓
Login
```

**Login**

```text
Email + Password
        OR
Continue with Google
        ↓
Authenticated Session
        ↓
Dashboard
```

**Account Linking**

```text
Authenticated User
        ↓
Account Settings
        ↓
Connect Google
        ↓
Linked Account
```

---

## 26. Acceptance Criteria

The feature is complete when:

1. Users can register using email/password.
2. Registration automatically triggers email OTP.
3. Users cannot log in before email verification.
4. Verified users can log in using email/password.
5. Users can authenticate using Google.
6. Existing accounts can explicitly link Google.
7. Authentication sessions are managed by Better Auth.
8. Protected Next.js pages validate sessions.
9. Protected Route Handlers enforce authorization.
10. MongoDB stores authentication records.
11. Docker MongoDB works locally.
12. MongoDB Atlas works in production.
13. Vercel deployment requires only one Next.js project.
14. No unnecessary custom authentication infrastructure is introduced.

---

## 27. Official Documentation

Next.js:
https://nextjs.org/docs

Better Auth:
https://better-auth.com/docs

Next.js Integration:
https://better-auth.com/docs/integrations/next

Email OTP:
https://better-auth.com/docs/plugins/email-otp

MongoDB Adapter:
https://better-auth.com/docs/adapters/mongo

Google Authentication:
https://better-auth.com/docs/authentication/google

User Accounts and Linking:
https://better-auth.com/docs/concepts/users-accounts

Resend:
https://resend.com/docs

MongoDB:
https://www.mongodb.com/docs
