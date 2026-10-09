# WhatsApp Task Reminder System

A MERN-stack application that lets users create **tasks, reminders, and notes** from a
web dashboard **or directly from WhatsApp chat**, and delivers scheduled WhatsApp
notifications through **WhatsApp's built-in Third-Party Agent API**.

---

## Table of Contents

1. [What is a WhatsApp Agent?](#1-what-is-a-whatsapp-agent)
2. [Creating your own Agent inside WhatsApp](#2-creating-your-own-agent-inside-whatsapp)
3. [The two core Agent API endpoints](#3-the-two-core-agent-api-endpoints)
   - [Send a message — `POST /messages`](#31-send-a-message--post-messages)
   - [Poll for messages — `GET /updates`](#32-poll-for-messages--get-updates)
4. [Authentication — sending the API key](#4-authentication--sending-the-api-key)
5. [About this project](#5-about-this-project)
   - [Why it was built](#51-why-it-was-built)
   - [Architecture](#52-architecture)
   - [How the WhatsApp chat is integrated](#53-how-the-whatsapp-chat-is-integrated)
   - [How the reminder scheduler works](#54-how-the-reminder-scheduler-works)
   - [How the web dashboard works](#55-how-the-web-dashboard-works)
6. [Project structure](#6-project-structure)
7. [Tech stack](#7-tech-stack)
8. [Local setup](#8-local-setup)
9. [Environment variables](#9-environment-variables)
10. [Available scripts](#10-available-scripts)
11. [WhatsApp bot commands](#11-whatsapp-bot-commands)
12. [API reference](#12-api-reference)
13. [Deployment](#13-deployment)
14. [Troubleshooting](#14-troubleshooting)
15. [FAQ](#15-faq)

---

## 1. What is a WhatsApp Agent?

A **WhatsApp Agent** is a special contact you create **inside the WhatsApp app itself**.
It's a chat that behaves like a person — you send it messages, it replies — except the
"person" is a program you (the developer) control through an HTTP API.

WhatsApp hosts the chat. Your server hosts the brain.

Users see it as an ordinary chat in their WhatsApp list, with its own **name** and
**profile picture**. Behind the scenes, WhatsApp exposes two REST endpoints that let
your server:

1. **Receive messages** the user sends to the agent.
2. **Send replies** back to the user.

This is called the **Third-Party Agent Platform**, and it's the foundation this
project is built on.

### It is NOT the WhatsApp Business Cloud API

These are two completely different products from Meta:

| Feature | WhatsApp Business Cloud API | WhatsApp Agent API (this project) |
|---|---|---|
| Where you create it | Meta Developer Portal | Inside the WhatsApp app |
| Who it's for | Businesses messaging customers at scale | Individual agents / assistants / bots |
| Auth | Business access token + WABA ID + phone number ID | A single **Agent API key** |
| Endpoints | `graph.facebook.com/vXX.X/...` | `api.whatsapp.com/agent/v1/...` |
| Recipient id | Phone number (`+92333...`) | `user:<digits>` string |
| Message types | Templates, media, interactive | Text (may extend later) |
| User onboarding | Business initiates with template | User connects the agent themselves |
| Requires a phone number | Yes | No |

**You don't need the Meta Developer Portal, a business account, or a phone number
ID for this project.** You create the agent inside WhatsApp, copy one API key, and
your server is ready to talk.

---

## 2. Creating your own Agent inside WhatsApp

This is the exact flow — you do everything from your phone, inside WhatsApp.

### Prerequisites

- WhatsApp installed and logged in on your phone
- A backend server that's reachable over the internet (Render, Railway, Fly, etc.)
  — this is what receives the messages and sends replies
- That's it. No developer account needed.

### Step-by-step

**1. Open WhatsApp on your phone.**

**2. Go to Settings → Agents (or "Linked Agents" / "AI & Agents").**

The label depends on your WhatsApp version. It typically lives near
*Linked Devices* or *Account*. If you can't find it, use the search inside
WhatsApp Settings.

**3. Tap "Create Agent" (or "New Agent").**

**4. Fill in the agent profile:**

| Field | Example | Notes |
|---|---|---|
| **Name** | `MyReminderBot` | This is what shows in the chat list |
| **Profile picture** | any image | Shown as the chat avatar |
| **Description** (optional) | `Sends me task reminders` | Shown on the agent's info screen |

Tap **Create** / **Save**.

**5. The agent appears as a new chat in your WhatsApp.**

Open it — you can already send messages to it (they'll just sit there until your
server starts polling).

**6. Open the agent's settings inside WhatsApp and copy the API key.**

You'll see something labeled **API key** or **Agent API key**. It looks like a long
random string, sometimes JWT-shaped:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VudF9pZCI6...
```

**Copy it immediately and store it somewhere safe.** Some versions only show it
once — if you lose it, you may need to regenerate.

> ⚠️ Treat this key like a password. Anyone who has it can send and receive messages
> as your agent.

**7. Note the API base URL.**

Every WhatsApp Agent uses:

```
https://api.whatsapp.com/agent/v1
```

Both endpoints (`/messages` and `/updates`) live under this base.

**8. Save the key into your backend's `.env`.**

In this project:

```env
WHATSAPP_AGENT_KEY=eyJhbGciOi...
WHATSAPP_API_BASE=https://api.whatsapp.com/agent/v1
```

**9. Verify the connection.**

Send any message from your phone to the agent chat (e.g. `hello`). Then from your
terminal:

```bash
curl -s "https://api.whatsapp.com/agent/v1/updates?offset=0&limit=1&timeout=0" \
  -H "Authorization: Bearer $WHATSAPP_AGENT_KEY"
```

If everything's correct, you'll get a JSON response containing the message you just
sent — including a `from` field like:

```json
"from": "user:233710897094724"
```

**That `user:<digits>` string is how you address this user when sending replies.**
Save it — you'll need it as the `to` field in every message you send them.

**10. You're done.**

Your agent is live. Any message a user sends to it will queue up on WhatsApp's
side, waiting for your server to read it via `/updates`. And any call your server
makes to `/messages` will show up in the chat instantly.

---

## 3. The two core Agent API endpoints

Your app talks to WhatsApp through exactly two endpoints. That's the entire
integration surface.

### 3.1 Send a message — `POST /messages`

Sends a message **from your agent to a WhatsApp user**.

**Request**

```
POST https://api.whatsapp.com/agent/v1/messages
Authorization: Bearer <AGENT_API_KEY>
Content-Type: application/json
```

```json
{
  "messaging_product": "whatsapp",
  "to": "user:233710897094724",
  "type": "text",
  "text": {
    "body": "Hello from my agent!"
  }
}
```

**Fields**

| Field | Required | Value |
|---|---|---|
| `messaging_product` | yes | Always `"whatsapp"` |
| `to` | yes | Recipient id including `user:` prefix |
| `type` | yes | `"text"` for plain text |
| `text.body` | yes | Message text (max ~4096 chars) |

**Success response — `200`**

```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "user:233710897094724", "wa_id": "233710897094724" }],
  "messages": [{ "id": "wamid.HBgL..." }]
}
```

**Common errors**

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `131009` | Body missing / malformed |
| 401 | — | Bad or missing API key |
| 429 | `130429` | Rate limit exceeded — back off |

> Note: the `to` field **must include the `user:` prefix**. A bare number is
> rejected with a body-validation error.

---

### 3.2 Poll for messages — `GET /updates`

Fetches inbound messages sent **by users to your agent**, using **long polling**.
The request blocks on the server for up to `timeout` seconds if there's nothing new.

**Request**

```
GET https://api.whatsapp.com/agent/v1/updates?offset=0&limit=50&timeout=25
Authorization: Bearer <AGENT_API_KEY>
```

**Query parameters**

| Parameter | Meaning |
|---|---|
| `offset` | Cursor from which to read. The response returns a `next_offset` you should use on the next call. **Persist this value.** |
| `limit` | Max updates to return per call (start with `50`). |
| `timeout` | Long-poll seconds to wait for new messages (`0`–`25` typical). |

**Response**

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "user:233710897094724",
                "id": "wamid...",
                "timestamp": "1727948400",
                "text": { "body": "hello" }
              }
            ]
          }
        }
      ]
    }
  ],
  "next_offset": 12345
}
```

**Critical rules**

- **Always advance and persist `next_offset`.** If you don't, you'll re-process
  the same messages forever (and hit rate limits).
- Long polling means the request can take up to `timeout` seconds. Set your client
  HTTP timeout to at least `timeout + 5` seconds.
- `offset=0` on first call. After that, use the stored `next_offset`.
- If you ever need to skip a backlog, set the stored offset to the current
  `next_offset` — new messages after that point will be processed normally.

---

## 4. Authentication — sending the API key

Every request to `/messages` or `/updates` must include the Agent API key as a
Bearer token:

```
Authorization: Bearer <YOUR_AGENT_API_KEY>
```

**Never put the key in the URL, the query string, or a JSON body.** It must go in
the header.

### In Node.js with axios

```js
const client = axios.create({
  baseURL: 'https://api.whatsapp.com/agent/v1',
  headers: {
    Authorization: `Bearer ${process.env.WHATSAPP_AGENT_KEY}`,
    'Content-Type': 'application/json',
  },
});
```

### In curl

```bash
curl -X POST "https://api.whatsapp.com/agent/v1/messages" \
  -H "Authorization: Bearer $WHATSAPP_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"user:233710897094724","type":"text","text":{"body":"hi"}}'
```

### Security checklist

- Store the key in `.env` (never commit it).
- Rotate the key if it's ever leaked (screenshots, GitHub, chat logs).
- Use HTTPS in production.
- On Render/Vercel, set it as an **Environment Variable** — never in code.
- Rate-limit your own endpoints so your key isn't abused on your behalf.

---

## 5. About this project

### 5.1 Why it was built

Sending yourself reminders on a phone requires trusting a random app's push
notifications, which are easy to miss. WhatsApp is already open on most people's
phones all day. This project turns WhatsApp into your **reminder channel**:

- Create tasks, reminders, and notes from a clean **web dashboard**.
- Or add them by **chatting with the WhatsApp agent** (`add task`, `add note`, …).
- At the scheduled time, the agent **sends you a WhatsApp message** with the
  reminder.
- You never install another app; you never miss a reminder.

It also demonstrates a full-stack production-grade MERN application with:

- JWT auth
- A scheduled background job (cron)
- A conversational state machine
- Rate limiting, retries, and resilience
- Multi-channel UX (web + WhatsApp) against a shared backend

### 5.2 Architecture

```
                       ┌───────────────────────────┐
                       │       React Dashboard     │
                       │   (Vite, deployed to Vercel)
                       └─────────────┬─────────────┘
                                     │  HTTPS / JWT
                                     ▼
   ┌────────────────────────────────────────────────────────────┐
   │                     Express + Node (Render)                │
   │                                                            │
   │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
   │  │ Auth (JWT)   │  │ REST API     │  │ Reminder Cron   │   │
   │  │              │  │ /tasks …     │  │ (every 60 s)    │   │
   │  └──────────────┘  └──────────────┘  └────────┬────────┘   │
   │                                               │            │
   │  ┌────────────────────────────────────────┐   │            │
   │  │ Inbound WhatsApp Poller (every 5 s)    │   │            │
   │  └────────────────┬───────────────────────┘   │            │
   └───────────────────┼───────────────────────────┼────────────┘
                       │                           │
                       ▼                           ▼
              GET /updates                 POST /messages
                       │                           │
                       └────────────┬──────────────┘
                                    ▼
                          WhatsApp Agent API
                                    ▲
                                    │
                              WhatsApp user
                                    ▲
                                    │
                       ┌────────────┴──────────────┐
                       │       MongoDB Atlas       │
                       │ users, tasks, reminders,  │
                       │ notes, conversations,     │
                       │ heartbeats, agentoffsets  │
                       └───────────────────────────┘
```

### 5.3 How the WhatsApp chat is integrated

The chat bot is a **stateful conversation engine** backed by MongoDB.

**Two directions:**

1. **Inbound** — `jobs/inboundCron.js` long-polls `GET /updates` every 5 seconds.
   Each new message is dispatched to `services/conversation.service.js`.

2. **Outbound** — the same service calls `services/whatsappQueue.js`, which queues
   replies so they go out at most ~1 per 1.2 seconds (respecting WhatsApp rate
   limits).

**State machine**

Each WhatsApp user has a `Conversation` document:

```json
{
  "whatsappId": "user:233710897094724",
  "userId": "6ac01eef...",
  "state": "task.dueAt",
  "draft": {
    "title": "Prepare quote",
    "description": "Customer X",
    "__lastText": "Prepare quote",
    "__lastAt": "2026-10-05T13:20:00.000Z"
  }
}
```

State examples:

```
idle
 ├─ "add task"       → task.title
 │     → task.description
 │     → task.dueAt          (parses "in 30 minutes", "10/05/2026/09:00:pm", …)
 │     → task.remindBefore
 │     → task.priority       (creates the Task, replies ✅)
 │
 ├─ "add reminder"   → reminder.text → reminder.remindAt (creates Reminder)
 │
 └─ "add note"       → note.title → note.body → note.tags → note.remindAt (creates Note)
```

Because state lives in MongoDB, you can **restart the server mid-conversation**
and the user picks up exactly where they left off.

**Timezone handling**

Every date the user types is interpreted in **their timezone** (stored on their
`User` record, default `Asia/Karachi`). The parser uses an `Intl.DateTimeFormat`-
based helper to convert wall-clock → UTC, which is correct even across DST.

**Offset tracking**

The poller stores the last `next_offset` in an `AgentOffset` document. This
guarantees messages are processed **once and only once**, even if the process
crashes and restarts.

### 5.4 How the reminder scheduler works

`jobs/reminderCron.js` runs every minute and scans three collections:

```js
Task.find({ sent: false, remindAt: { $lte: now }, attempts: { $lt: 3 } })
Reminder.find({ sent: false, remindAt: { $lte: now }, attempts: { $lt: 3 } })
Note.find({ sent: false, remindAt: { $lte: now }, attempts: { $lt: 3 } })
```

For each candidate:

1. **Atomic claim** via `findOneAndUpdate({ sent: false }, { $inc: { attempts: 1 } })`.
   Only one worker can win the claim, even under concurrency.
2. **Send** through the WhatsApp queue.
3. **Success** → `sent: true`, `sentAt: now`.
4. **Failure** →
   - Network errors (`ENOTFOUND`, `EAI_AGAIN`, timeouts) don't consume attempts —
     they retry silently next tick.
   - Rate limits (`130429`) trigger exponential backoff.
   - Any other error marks `lastError` and, after 3 attempts, `status: 'failed'`.

Every model has the same shape:

```
remindAt    Date     indexed
sent        Boolean  indexed
sentAt      Date
attempts    Number
lastError   String
```

And a compound index `{ sent: 1, remindAt: 1 }` makes the scan O(log n).

**Heartbeat**: each tick writes to a `Heartbeat` doc. `/api/system/health`
exposes it so UptimeRobot or a dashboard can detect a dead cron.

### 5.5 How the web dashboard works

The React app (Vite) talks to the API via axios. Every request:

- Adds `Authorization: Bearer <jwt>` from `localStorage`
- On `401`, clears the token and redirects to `/login`

Pages:

| Page | What it does |
|---|---|
| `/login`, `/register` | JWT auth |
| `/tasks` | Create / list / filter / mark done / delete tasks |
| `/reminders` | Create / list / delete reminders |
| `/notes` | Create / list / delete notes |
| `/settings` | Show account info, WhatsApp id, timezone |

Timezone handling on the frontend:

- `datetime-local` inputs are **local** — they are converted with
  `localInputToISO()` to UTC ISO strings before being sent to the server.
- Display uses `formatLocal()` — the browser's locale converts UTC → local.

That means the same reminder always shows the same wall-clock time regardless of
whether you look at it from the dashboard, from WhatsApp, or from the server logs.

---

## 6. Project structure

```
reminder-system/
├── server/
│   ├── src/
│   │   ├── app.js                    # Express app, middleware, status page at "/"
│   │   ├── server.js                 # Entry: connects DB, starts crons, listens
│   │   ├── config/
│   │   │   ├── env.js                # Loads .env, validates required vars
│   │   │   └── db.js                 # Mongoose connection
│   │   ├── models/
│   │   │   ├── index.js
│   │   │   ├── User.js
│   │   │   ├── Task.js
│   │   │   ├── Reminder.js
│   │   │   ├── Note.js
│   │   │   ├── Conversation.js
│   │   │   ├── AgentOffset.js
│   │   │   ├── Heartbeat.js
│   │   │   └── plugins/remindable.js
│   │   ├── middleware/
│   │   │   ├── requireAuth.js        # JWT verification
│   │   │   └── requireUser.js        # (legacy) header-based user lookup
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── task.controller.js
│   │   │   ├── reminder.controller.js
│   │   │   ├── note.controller.js
│   │   │   ├── whatsapp.controller.js
│   │   │   ├── system.controller.js
│   │   │   └── admin.controller.js
│   │   ├── services/
│   │   │   ├── auth.service.js       # bcrypt + JWT
│   │   │   ├── whatsapp.js           # sendWhatsApp + pollInboundUpdates
│   │   │   ├── whatsappQueue.js      # Throttled outbound queue
│   │   │   └── conversation.service.js # State machine for WhatsApp chat
│   │   ├── jobs/
│   │   │   ├── reminderCron.js       # Fires due reminders
│   │   │   └── inboundCron.js        # Polls WhatsApp for new messages
│   │   ├── routes/
│   │   │   ├── index.js              # Mounts all routes
│   │   │   ├── auth.routes.js
│   │   │   ├── task.routes.js
│   │   │   ├── reminder.routes.js
│   │   │   ├── note.routes.js
│   │   │   ├── whatsapp.routes.js
│   │   │   ├── system.routes.js
│   │   │   └── admin.routes.js
│   │   └── utils/
│   │       ├── http.js               # HttpError helpers
│   │       ├── validate.js           # Field validators
│   │       └── asyncHandler.js       # try/catch for async controllers
│   ├── scripts/
│   │   ├── seed.js
│   │   ├── get-user.js
│   │   └── reset-offset.js
│   ├── .env.example
│   └── package.json
│
└── client/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── api.js
    │   ├── auth/
    │   │   ├── AuthContext.jsx
    │   │   └── RequireAuth.jsx
    │   ├── components/
    │   │   ├── EmptyState.jsx
    │   │   ├── Loading.jsx
    │   │   ├── StatusBadge.jsx
    │   │   └── Toast.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Tasks.jsx
    │   │   ├── Reminders.jsx
    │   │   ├── Notes.jsx
    │   │   └── Settings.jsx
    │   ├── utils/
    │   │   └── datetime.js
    │   └── index.css
    ├── .env.example
    └── package.json
```

---

## 7. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, axios, dayjs |
| Backend | Node 20, Express 4, Mongoose 8 |
| Auth | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| Scheduler | `node-cron` |
| WhatsApp | Built-in Agent API (REST) |
| Database | MongoDB Atlas |
| Hosting | Vercel (client), Render (server), Atlas (db) |

---

## 8. Local setup

### Requirements

- Node.js 20+
- MongoDB (local or Atlas)
- A WhatsApp Agent + its API key (see section 2)

### Clone & install

```bash
git clone https://github.com/your-name/reminder-system.git
cd reminder-system

# server
cd server
npm install
cp .env.example .env       # then edit .env
npm run dev                # http://localhost:4000

# client (in a second terminal)
cd ../client
npm install
cp .env.example .env       # then edit .env
npm run dev                # http://localhost:5173
```

### Seed a test user

```bash
cd server
npm run seed
# outputs: email, password, user _id, whatsappId
```

Then open http://localhost:5173 and log in.

---

## 9. Environment variables

### `server/.env`

```env
PORT=4000
NODE_ENV=development

MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/reminders?retryWrites=true&w=majority

WHATSAPP_AGENT_KEY=eyJhbGciOi...
WHATSAPP_API_BASE=https://api.whatsapp.com/agent/v1

JWT_SECRET=replace_with_a_long_random_string_at_least_32_chars
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

TZ=UTC
DEFAULT_TIMEZONE=Asia/Karachi
LOG_LEVEL=dev

# Comma-separated list — only enforced when NODE_ENV=production
CORS_ORIGINS=https://your-client.vercel.app
```

Generate `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `client/.env`

```env
VITE_API_URL=http://localhost:4000/api
```

---

## 10. Available scripts

### Server

| Script | What it does |
|---|---|
| `npm run dev` | Start with nodemon |
| `npm start` | Start without reload (production) |
| `npm run seed` | Wipe DB and insert a test user + samples |
| `npm run who` | Print the first user's `_id` and `whatsappId` |
| `npm run reset-offset <n>` | Set the WhatsApp poll offset |

### Client

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

---

## 11. WhatsApp bot commands

Send these to your agent chat:

| Command | Effect |
|---|---|
| `help` | Show available commands |
| `add task` | Start the task creation flow |
| `add reminder` | Start the reminder flow |
| `add note` | Start the note flow |
| `list` | Show your next pending tasks/reminders/notes |
| `cancel` | Abort the current flow |

### Date formats accepted

| Example | Meaning |
|---|---|
| `10/05/2026/09:00:pm` | MM/DD/YYYY/HH:MM:am\|pm |
| `10/05/2026 21:00` | MM/DD/YYYY HH:MM (24-hour) |
| `2026-10-05 21:00` | ISO-like |
| `09:00 pm` | Time only — today, or tomorrow if past |
| `21:00` | Same, 24-hour |
| `in 30 minutes` | Relative |
| `in 2 hours` | Relative |
| `tomorrow 09:00` | Tomorrow at 09:00 |
| `today 21:00` | Today at 21:00 |

Every date is interpreted in **your account's timezone** (default `Asia/Karachi`).

---

## 12. API reference

All `/api/*` routes except auth require:

```
Authorization: Bearer <jwt>
```

### Auth

| Method | Path | Body |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password, whatsappId, timezone? }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/me` | — |

### Tasks

| Method | Path | Notes |
|---|---|---|
| POST | `/api/tasks` | `{ title, description?, dueAt, remindBeforeMinutes?, priority? }` |
| GET | `/api/tasks?status=pending` | List |
| GET | `/api/tasks/:id` | Get one |
| PATCH | `/api/tasks/:id` | Update — recomputes `remindAt` if `dueAt` changes |
| POST | `/api/tasks/:id/done` | Mark done |
| POST | `/api/tasks/:id/retry` | Reset for retry if failed |
| DELETE | `/api/tasks/:id` | Delete |

### Reminders

| Method | Path |
|---|---|
| POST | `/api/reminders` |
| GET | `/api/reminders?includeSent=true` |
| PATCH | `/api/reminders/:id` |
| POST | `/api/reminders/:id/retry` |
| DELETE | `/api/reminders/:id` |

### Notes

| Method | Path |
|---|---|
| POST | `/api/notes` |
| GET | `/api/notes` |
| PATCH | `/api/notes/:id` |
| POST | `/api/notes/:id/retry` |
| DELETE | `/api/notes/:id` |

### System

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | JSON, unauthenticated |
| GET | `/api/system/health` | Cron heartbeat info |
| GET | `/` | HTML status page |

---

## 13. Deployment

### MongoDB Atlas

1. Create a free M0 cluster.
2. Database Access → add a user with `readWrite` on `reminders`.
3. Network Access → allow your host IPs (or `0.0.0.0/0` for small apps).
4. Copy the connection string into `MONGO_URI`.

### Server → Render

1. New Web Service → connect GitHub repo.
2. **Root Directory**: `server`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Health Check Path**: `/health`
6. Set all `server/.env` variables in **Environment**.
7. Deploy.

> ⚠️ The **free tier** spins down after 15 minutes of inactivity, which kills the
> cron and inbound poller. Use the Starter plan ($7/mo) or ping `/health` every
> 5 minutes with UptimeRobot.

### Client → Vercel

1. New Project → import same repo.
2. **Root Directory**: `client`
3. **Framework**: Vite
4. **Environment Variable**: `VITE_API_URL = https://your-render-url/api`
5. Deploy.

Then update `CORS_ORIGINS` on Render to include the new Vercel domain.

---

## 14. Troubleshooting

| Symptom | Fix |
|---|---|
| `getaddrinfo ENOTFOUND api.whatsapp.com` | Add `dns.setServers(['8.8.8.8','1.1.1.1'])` at the top of `whatsapp.js` and `db.js`. |
| `(#130429) exceeded the maximum number of requests` | Rate limit — wait a few minutes. The queue throttles to ~1 msg / 1.2 s. |
| Bot doesn't reply to messages | Check the `AgentOffset` doc — reset with `npm run reset-offset 0`. |
| Duplicate reminders | Check only one server instance is running; the claim uses `findOneAndUpdate`. |
| Reminder fires at wrong time | Check `user.timezone` in Mongo, and the server's `TZ` env var. |
| 401 on every request | JWT expired or missing. Log in again on the dashboard. |
| `whatsappId already in use` on register | Each account needs a unique WhatsApp id. Delete the test account or use a different one. |
| `next_offset` never changes | You're advancing offset but not saving. Ensure `doc.save()` runs after each poll. |

---

## 15. FAQ

**Q: Do I need a Meta Developer account or the WhatsApp Business API?**
No. The agent is created **inside WhatsApp**, not through Meta's developer portal.
You only need the API key WhatsApp shows you after creating the agent.

**Q: Where do I create the agent?**
WhatsApp app → **Settings → Agents** → **Create Agent** → set name, picture,
description → **Create**. The API key is shown in the agent's settings.

**Q: Can I send media / buttons?**
The Agent API currently supports text. Media support depends on platform updates.

**Q: How many messages can I send per minute?**
The exact limit isn't published. The queue throttles to ~50/min by default. If you
hit `130429`, back off — the code does this automatically.

**Q: Does this work without a phone?**
No. The user's WhatsApp account is the recipient. You message your own agent chat.

**Q: Can multiple people use it?**
Yes — each registers their own account with their own `whatsappId`. Conversations
are keyed by `whatsappId`.

**Q: What if the server restarts mid-conversation?**
The `Conversation` state is in MongoDB, so the flow resumes.

**Q: Is the WhatsApp chat encrypted?**
Per the Third-Party Agent terms, conversations with connected third-party agents
are not end-to-end encrypted the same way as normal WhatsApp chats. Do not send
sensitive data through the agent.

**Q: How do I rotate the API key?**
Regenerate it in the agent's settings inside WhatsApp, update
`WHATSAPP_AGENT_KEY` everywhere (`.env` on Render and locally), and restart the
server.

---

## License

MIT — see `LICENSE`.

## Credits

Built on WhatsApp's **built-in Third-Party Agent API**, and the following
open-source projects: Express, Mongoose, axios, node-cron, React, Vite, React
Router, dayjs, bcryptjs, jsonwebtoken.