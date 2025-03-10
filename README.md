This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Env Variables

Create a .env file in the root of the project

Input your Orb API token value in an env variable called ORB_API_TOKEN

Input the path to the Python backfill script in .env - Use PYTHON_BACKFILL_SCRIPT_PATH

## Run the web app

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

## Check results

When the backfill script executes, it should log to the terminal and provide status updates for your backfill
