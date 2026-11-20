# clinic-booking-legacy

Companion code for the Sypher course "AI-Assisted Software Engineering".

The course works on one app from start to finish: a small appointment booking service for a made-up clinic, Harbor Street Clinic. Patients pick a doctor, a day and a free half-hour slot; the front desk sees each day's list and exports it. The app is Node.js 24 and TypeScript, uses Node's built-in SQLite module and test runner, and has no runtime packages.

The version in `start/` is deliberately imperfect: it has real bugs, copy-pasted logic and a token written in the code. During the course you improve it, one lesson at a time, with the help of an AI coding assistant.

## Set up your computer

You need Git and Node.js 24 or newer. An AI coding assistant is needed only to repeat the course's assistant sessions; the app and its tests run without one.

### Windows

1. Install Git (it includes Git Bash): `winget install --id Git.Git -e`
2. Install Node.js 24 with the fnm version manager: `winget install Schniz.fnm`, open a new terminal, then `fnm install 24` and `fnm use 24`.
3. Use Git Bash for the commands below. Run `export MSYS_NO_PATHCONV=1` in each new Git Bash window so arguments that start with `/` are not turned into Windows paths.

### macOS

1. Install Homebrew if you do not have it, then `brew install git fnm`.
2. `fnm install 24` and `fnm use 24` (follow the line fnm prints to add it to your shell).

### Linux (Ubuntu or Debian)

1. `sudo apt update && sudo apt install -y git curl unzip`
2. Install fnm with its install script from the fnm project page, open a new terminal, then `fnm install 24` and `fnm use 24`.

### Check the tools

```bash
git --version
node --version
npm --version
```

`node --version` must print `v24` or a higher major version. The code was tested on Node.js 24.19 and 26.13.

### Get the code

```bash
git clone <clinic-booking-legacy repository URL> clinic-booking-legacy
cd clinic-booking-legacy
```

## Run the app

Copy the folder you want to run (the course has you copy `start/` once, into a working folder of your own), install the development tools and start it:

```bash
cp -r start ~/clinic-work
cd ~/clinic-work
npm ci
npm start
```

Open http://localhost:18800 for the booking page and http://localhost:18800/desk.html for the front desk page.

From lesson 15 onwards (`steps/15-...`, `steps/16-...`, `steps/17-...` and `app/`), the server needs a front desk token in the environment and refuses to start without one:

```bash
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Paste the printed value after `ADMIN_TOKEN=` in `.env`, then `npm start`. Never commit `.env`.

To fill a day with demo appointments: `npm run seed -- 2030-03-04`, then pick that date on the booking page. The database is the file `data/clinic.db`; delete the `data` folder to start with an empty diary.

## Run the tests

In any app folder, after `npm ci`:

```bash
npm test          # all tests
npm run check     # type check, lint, then all tests
```

The tests start their own copy of the server on a random port with an in-memory database, so they never touch your data and need no `.env` file.

## Project layout

```text
start/        the legacy app as you receive it in lesson 1
steps/        the app at the end of each lesson that changes it (see steps/README.md)
app/          the finished app after the capstone (the same as the last step)
.github/      this repository's CI: type check, lint and tests for every folder above
```

Each of `start/`, every `steps/` folder and `app/` is a complete, separate project with its own `package.json`. Inside each one:

```text
src/          the server: main.ts, server.ts, router.ts, config.ts, db.ts
  routes/     HTTP handlers
  lib/        rules, time and schedule helpers, audit log
  store/      all SQL (from lesson 12 on)
public/       the booking page and the front desk page, plain browser JavaScript
test/         node:test tests
scripts/      seed-demo.ts adds demo appointments
docs/         project-guidelines.example.md (from lesson 13 on), specs (capstone)
```

From lesson 16 on, each copy also contains `.github/workflows/ci.yml`: the workflow written in that lesson for the app's own repository. GitHub only runs workflows at the root of a repository, so inside this repository those files are examples; the root workflow is the one that runs here.

## Troubleshooting

- **`node: bad option` or `Unknown file extension ".ts"`:** your Node.js is older than 24. Run `node --version`, then `fnm use 24`.
- **`EADDRINUSE: address already in use :::18800` or `127.0.0.1:18800`:** another copy of the app is running. Stop it with Ctrl+C in its terminal, or start this one with `PORT=18801 npm start`.
- **`Not starting: ADMIN_TOKEN is not set`:** from lesson 15 on the app needs a `.env` file; see "Run the app".
- **`npm ci` reports moderate vulnerabilities:** they are in the lint tools, which only run on your computer. The course discusses them in lesson 15. Do not run `npm audit fix --force`, which would downgrade ESLint.
- **The page shows times that are not in your time zone:** the clinic is on UTC-8 (Pacific Standard Time) all year, whatever your computer's time zone. That is intended.
- **A test fails after you changed code:** run `git diff` to see your change, and compare with the matching `steps/` folder.

## License

Copyright (C) 2026 SypherNext

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). You may
use, study and change it. If you share a modified version, or run one as a website or service
that other people use, you must make your full modified source code available under the same
license. See [LICENSE](LICENSE) for the full terms.
