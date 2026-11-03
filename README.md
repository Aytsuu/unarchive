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

On Windows, `npm run stack` starts Docker Desktop when needed, starts MongoDB,
installs dependencies, and starts the development server in the background at
http://localhost:3000. Its logs are in `.stack/`. Run `npm run stop` to stop the
project's development server and MongoDB, or `npm run stop -- --docker-quit` to
also quit Docker Desktop. The MongoDB data volume is preserved. If another
process occupies port 3000, stop it before starting the stack.

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
