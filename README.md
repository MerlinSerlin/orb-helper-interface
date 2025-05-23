# Orb Helper Interface setup and quick tutorial

### This is a web app that can do two things:

1. Send events to Orb's ingestion API (event generator)

2. Create a backfill and send events (backfill generator)

While this site has a live front-end deployed on Vercel (you can deploy your own site of course), I'd recommend running the backfill generator locally (since the Python script will execute locally).

If you want to deploy your own site so you don't have to run the event generator locally every time, don't forget to set your environment variables on Vercel! https://vercel.com/docs/environment-variables  

## Setup for running locally

Create a .env file in the root of the project.

Input your Orb API token value in an env variable called ORB_API_TOKEN

### If you want to run a backfill

Input your path value for the backfill script in an env variable called PYTHON_BACKFILL_SCRIPT_PATH (value might be something like: /{your_path}/orb-helper-interface/src/scripts/Backfills/backfill_events.py)

## How To Use

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

### Using the event generator

The web app allows you to submit an event or multiple events via the web UI. Events will have unique idempotency keys generated.

#### Randomizing values for multiple events.

The web app allows you to create multiple events at a time. When defining event properties, you can click the 'Randomize values for lookalike' checkbox after entering a key value. 

Example use: if your event key is fruit, you may want to generate values randomlly against a set of defined values (e.g. apple, banana). You can also select a range of integers (e.g. 1-100)

### Using the backfill generator

The backfill web UI allows you to enter a range of dates for the backfill. You'll also be able to set property values and use the same randomization feature as the event generator.

#### Under the hood:

The backfill will create "chunks" of events to respect Orb's 10 day backfill window. By default, you can't go more than 90 days in the past for start date, and no less than 2 days in the past for end date. This is to respect the 90 day soft limit Orb has for backfills, and also to ensure we don't send in events that have happened within the 12 hour grace period. 

When you click the Submit Backfill Job button, logging for that job should be printed in the terminal.
