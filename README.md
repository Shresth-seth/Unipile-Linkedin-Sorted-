# WORKPILOT

WORKPILOT is a full-stack web application featuring a modern **Next.js** frontend and an **Express + TypeScript** backend API.

---

## 📁 Project Structure

```text
WORKPILOT/
├── client/                     # Frontend Application (Next.js)
│   ├── app/                    # Next.js App Router (pages, layout, styles)
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── public/                 # Static assets (SVGs, images)
│   ├── .env.example            # Client environment variables template
│   ├── eslint.config.mjs       # ESLint configuration
│   ├── next.config.ts          # Next.js configuration
│   ├── package.json            # Client dependencies & scripts
│   ├── postcss.config.mjs      # PostCSS configuration
│   └── tsconfig.json           # Client TypeScript configuration
│
├── server/                     # Backend API Service (Express + TypeScript)
│   ├── src/
│   │   ├── config/
│   │   │   └── dotenv.config.ts # Environment variable loader
│   │   ├── app.ts              # Express application setup & middleware (CORS, cookies, JSON)
│   │   └── index.ts            # HTTP server initialization & entry point
│   ├── .env.example            # Server environment variables template
│   ├── package.json            # Server dependencies & scripts
│   └── tsconfig.json           # Server TypeScript configuration
│
├── .env.example                # Root environment variables reference
├── .gitignore                  # Git ignore rules for root, client, and server
└── README.md                   # Project documentation & setup guide
```

---

## 🛠️ Tech Stack

### Frontend (`client/`)

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Library:** [React 19](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Linting:** ESLint

### Backend (`server/`)

- **Runtime:** [Node.js](https://nodejs.org/) (ES Modules)
- **Framework:** [Express.js](https://expressjs.com/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Development Tooling:** [tsx](https://github.com/privatenumber/tsx) (watch mode & hot reloading)
- **Security & Utilities:** `cors`, `cookie-parser`, `dotenv`, `jsonwebtoken`, `bcrypt`, `express-rate-limit`, `express-validator`

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v18.17.0` or later (v20+ or v24 LTS recommended)
- **Package Manager**: `npm` (v9+ or later), `pnpm`, or `yarn`

Check your versions:

```bash
node -v
npm -v
```

---

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### 1. Configure Environment Variables

The project uses `.env` files to configure runtime settings for both the client and server.

#### Backend (`server/.env`)

Copy `server/.env.example` to `server/.env`:

```bash
# On Windows (PowerShell):
Copy-Item server/.env.example server/.env

# On Linux/macOS:
cp server/.env.example server/.env
```

Default values in `server/.env`:

```env
PORT=4000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

#### Frontend (`client/.env.local`)

Copy `client/.env.example` to `client/.env.local`:

```bash
# On Windows (PowerShell):
Copy-Item client/.env.example client/.env.local

# On Linux/macOS:
cp client/.env.example client/.env.local
```

Default values in `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

### 2. Install Dependencies

You need to install dependencies for both the `server` and the `client`.

#### Install Server Dependencies

```bash
cd server
npm install
cd ..
```

#### Install Client Dependencies

```bash
cd client
npm install
cd ..
```

---

### 3. Run the Development Servers

For local development, run the server and client in two separate terminal windows.

#### Terminal 1 — Backend Server

```bash
cd server
npm run dev
```

The server will start with hot-reloading enabled:

```
Server is running on port 4000
```

#### Terminal 2 — Frontend Client

```bash
cd client
npm run dev
```

The Next.js client will start at:

```
http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the client application.

---

## ⚙️ Environment Variables Reference

### Backend (`server/.env`)

| Variable     | Type   | Default                 | Description                                                |
| :----------- | :----- | :---------------------- | :--------------------------------------------------------- |
| `PORT`       | Number | `4000`                  | Port on which the Express server listens.                  |
| `CLIENT_URL` | String | `http://localhost:3000` | URL of the frontend client allowed by CORS middleware.     |
| `NODE_ENV`   | String | `development`           | Runtime environment (`development`, `production`, `test`). |
| `JWT_SECRET` | String | _(optional)_            | Secret key used for signing and verifying JWT tokens.      |

### Frontend (`client/.env.local`)

| Variable              | Type   | Default                 | Description                                                |
| :-------------------- | :----- | :---------------------- | :--------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | String | `http://localhost:4000` | Base URL of the backend API exposed to the client browser. |

---

## 📜 Available Scripts

### `server`

| Command         | Description                                                         |
| :-------------- | :------------------------------------------------------------------ |
| `npm run dev`   | Runs the server in development mode using `tsx watch src/index.ts`. |
| `npm run build` | Compiles TypeScript source files into JavaScript in `dist/`.        |
| `npm run start` | Runs the compiled production build from `dist/index.js`.            |

### `client`

| Command         | Description                                                       |
| :-------------- | :---------------------------------------------------------------- |
| `npm run dev`   | Starts the Next.js development server on `http://localhost:3000`. |
| `npm run build` | Creates an optimized production build of the Next.js app.         |
| `npm run start` | Runs the Next.js production server.                               |
| `npm run lint`  | Runs ESLint to inspect code for syntax and style issues.          |

---

## 🔧 Troubleshooting

- **Port in use (`EADDRINUSE: :::4000`):**
  Ensure no other process is running on port 4000. You can change `PORT` in `server/.env` to another port (e.g., `5000`) and update `NEXT_PUBLIC_API_URL` in `client/.env.local`.
- **CORS Error in Browser:**
  Ensure `CLIENT_URL` in `server/.env` matches the origin of your Next.js frontend (e.g. `http://localhost:3000`).
- **Missing Module Errors:**
  Run `npm install` inside both `server/` and `client/` directories.
