This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Local MongoDB

Install and start Docker Desktop, then copy `.env.examples` to `.env.local` and
replace the example password in both places with the same URL-safe password.
Start the database with:

```bash
docker compose --env-file .env.local up -d
```

MongoDB listens on `127.0.0.1:27017` and stores its data in a Docker volume.
`MONGODB_URI` is for a Next.js process running on the host. The root account is
for local development only. Stop the container with `docker compose --env-file
.env.local stop`. The initialization credentials apply only to a new data
volume; changing the environment variables later does not change an existing
MongoDB user's password.

### Authentication

Set `MONGODB_DB_NAME`, `BETTER_AUTH_URL`, and a unique `BETTER_AUTH_SECRET` in
`.env.local`; generate the secret with `openssl rand -base64 32`. Keep
`MONGO_ENABLE_TRANSACTIONS=false` for the standalone local MongoDB container.
Set `RESEND_API_KEY` and `EMAIL_FROM` to a Resend API key and a sender on a
verified domain to deliver verification codes. Without them, verification email
delivery cannot succeed.
Verification delivery runs after the response; delivery failures are logged
without the recipient or code and the user can request another code. This local
setup does not provide a durable retry queue.
Resend requests have a three-minute per-email cooldown; verification codes
expire after five minutes. Entering all six digits verifies the email and opens
the final signup step before the dashboard.
The current Better Auth MongoDB OTP flow has not been validated to serialize a
verification racing a resend across multiple application processes. Do not rely
on strict cross-process OTP rotation until that behavior is resolved and tested.

For Google sign-in and account linking, set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` for a Google OAuth web client. Add
`http://localhost:3000` as an authorized origin and
`http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
Both Google values must be configured together. Keep these values and the auth
secret out of version control. Restart the development server after changing
environment variables.
Google sign-in links to an existing account only when both Google and the
existing account have verified the same email address. Unverified accounts must
complete email verification first. Google sign-in cannot create an account;
new users must register through the signup page.

The local server does not trust forwarded IP headers, so authentication rate
limits use a shared bucket per endpoint. The first auth request creates unique
indexes for users, sessions, provider accounts, verification records and rate
limits; existing duplicate records cause index creation to fail and must be
resolved deliberately before authentication can start.

Run the authentication integration tests against the local MongoDB service:

```bash
node --env-file=.env.local --experimental-strip-types --test tests/auth.integration.mts
```

The tests use and remove a randomly named test database. They capture test emails
in memory; they do not exercise real Resend delivery or Google OAuth.

On Windows, `npm run stack` starts Docker Desktop when needed, starts MongoDB,
installs dependencies, and starts the development server in the background at
http://localhost:3000. Its logs are in `.stack/`. Run `npm run stop` to stop the
project's development server and MongoDB, or `npm run stop:docker` to
also quit Docker Desktop. The MongoDB data volume is preserved. If another
process occupies port 3000, stop it before starting the stack.

To reset all local authentication data, stop the app while keeping MongoDB
running, then run `npm run reset:auth` and type the displayed database name to
confirm. This deletes every user, account, session, verification code, resend
cooldown, and authentication rate limit in that database. It preserves indexes
and other collections. The command only accepts a single local MongoDB host;
environment variables already set in your shell take precedence over `.env.local`.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
