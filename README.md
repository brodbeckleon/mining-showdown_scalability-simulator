# Mining Showdown

> Multiplayer scaling competition for the ASE2 _Scalability / Large-Scale Software_ module at ZHAW.
> Teams compete to build the most efficient mining infrastructure under load — vertical scaling,
> load balancing, sharding. Live leaderboard for the projector, interactive topology view per team.

**GitHub:** [github.com/brodbeckleon/mining-showdown_scalability-simulator](https://github.com/brodbeckleon/mining-showdown_scalability-simulator)

---

## Overview

Mining Showdown is a real-time multiplayer game designed to teach distributed systems scaling concepts through competition. Each team configures a 3-tier infrastructure (App Nodes → Load Balancer → DB Shards) to process incoming requests as efficiently as possible. The host controls the global request load in real-time, forcing teams to adapt. The team with the highest cumulative score when the game ends wins.

The app uses a **private session** model: the teacher creates a session and receives a unique join link and QR code to share with students. No shared global game state.

---

## Tech Stack

| Layer     | Technology                           |
| --------- | ------------------------------------ |
| Framework | Next.js 15, React 18, TypeScript     |
| Styling   | Tailwind CSS, Lucide React           |
| Database  | Supabase (PostgreSQL)                |
| Realtime  | Supabase Realtime (postgres_changes) |

---

## Getting Started

### Prerequisites

- Node.js v18+
- A Supabase project with the required schema (see below)

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### Run

```bash
npm run dev       # Development server on http://localhost:3000
npm run build     # Production build
npm run start     # Production server
npm run typecheck # Type check without emitting
```

---

## Session Flow

1. **Teacher** opens `/create`, sets the game duration, and clicks **Create Session**.
2. The app generates a unique session code and redirects to `/session/[code]` — the host console with a built-in beamer view and shareable QR code.
3. **Students** open `/join/[code]` (via QR code or direct link), enter a team name, and start playing.
4. The teacher starts the game, adjusts the load over time, and can toggle **Fluctuate** for realistic spikes.
5. When time runs out the game stops automatically. The host view shows a final podium; students see a game-over overlay with their placement.

---

## Pages

| Route             | Audience | Description                                                                   |
| ----------------- | -------- | ----------------------------------------------------------------------------- |
| `/`               | Everyone | Landing page — create a private session or read the game rules                |
| `/create`         | Teacher  | Configure game duration and create a new session                              |
| `/session/[code]` | Teacher  | Host console + live leaderboard. Password-free; only the creator has controls |
| `/join/[code]`    | Students | Join a session, configure infrastructure, monitor live score and wallet       |

---

## Game Mechanics

### Goal

Process as many incoming HTTP requests as possible before the game ends. Drops (unhandled requests) earn nothing. Go bankrupt and you're eliminated.

### Infrastructure Configuration

Each team configures three scaling dimensions:

| Dimension  | Controls                                          | Max                                    |
| ---------- | ------------------------------------------------- | -------------------------------------- |
| Vertical   | CPU cores per node (1–16), RAM per node (1–64 GB) | 16 cores × 32 req/s = 512 req/s        |
| Horizontal | Node count (1–6) + Load Balancer toggle           | Requires LB to activate extra nodes    |
| Sharding   | DB shards (1–6)                                   | 6 × 850 req/s = 5100 req/s DB capacity |

> Without the Load Balancer enabled, only Node 1 is active regardless of node count — a classic misconfiguration.

### Economy

Teams start with **80 CHF**. Every second:

```
wallet += (throughput × EARN_RATE) - (infra_cost × SPEND_RATE)
```

| Constant      | Value                                        |
| ------------- | -------------------------------------------- |
| `EARN_RATE`   | 0.006 coins per processed request            |
| `SPEND_RATE`  | 0.01 coins per $/h infrastructure per second |
| `COST_CORE`   | $6/h per CPU core                            |
| `COST_GB_RAM` | $2/h per GB RAM                              |
| `COST_LB`     | $12/h flat                                   |
| `COST_SHARD`  | $9/h per shard                               |

Wallet ≤ 0 = **bankruptcy** → infrastructure goes offline, final score is frozen.

### Simulation Model

The simulation uses a simplified **M/M/1 queuing approximation** per tier (`src/lib/simulation.ts`):

**Capacity:**

```
cpuCapacity = activeNodes × cpuPerNode × 32 req/s
dbCapacity  = shards × 850 req/s
```

**Response Time** (explodes as utilization approaches 100%):

```
responseTime = 18ms / (1 - appUtil) + 8ms / (1 - dbUtil)
```

**RAM** (via Little's Law):

```
inflight   = load × (responseTime / 1000)
ramUsed    = inflight × 300 MB
```

If RAM usage exceeds 100%, throughput is throttled proportionally.

**Throughput & Drops:**

```
throughput = min(load, cpuCapacity, dbCapacity)
if ramUsed > ramTotal: throughput *= ramTotal / ramUsed
dropped    = load - throughput
```

### Bottleneck Detection

| State      | Condition         | Indicator |
| ---------- | ----------------- | --------- |
| Warning    | utilization > 70% | Amber     |
| Bottleneck | utilization ≥ 95% | Red       |
| None       | utilization ≤ 70% | Green     |

### Timer & Game Duration

The teacher sets the game duration via a slider (60–1200 s, default **360 s / 6 min**) before starting.
Once the game is running the slider is locked. A countdown is visible on both the host console and the leaderboard.

The timer supports **pause/resume**: elapsed seconds are encoded into `started_at` as a Unix-epoch offset so the state survives page reloads.

When time runs out the game stops automatically and teams see a **Game Over overlay** with their final score and placement. The host view switches to a **Final Results** podium.

### Load Controls

| Control              | Description                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Load Slider          | Sets global req/s (0–3000, step 50 by default)                                                                       |
| **Fluctuate** toggle | Randomizes load every second: spikes (1.8×–3×), dips (30–60%), or ±25% noise. Only active while the game is running. |

### Load Phases (preset buttons)

| Phase   | Load       |
| ------- | ---------- |
| Phase 1 | 200 req/s  |
| Phase 2 | 800 req/s  |
| Phase 3 | 1800 req/s |

---

## Scaling Strategies

Teams are automatically classified into one of six strategies (shown on the leaderboard overlay):

| Strategy          | Description                                    |
| ----------------- | ---------------------------------------------- |
| **Baseline**      | 1 node, minimal resources                      |
| **Vertical**      | 1 node, scaled-up CPU/RAM                      |
| **Load Balanced** | Multiple nodes with LB enabled                 |
| **Combined**      | Multiple large nodes with LB                   |
| **Sharded**       | Multiple nodes with DB sharding                |
| **Misconfig**     | Multiple nodes without LB (only node 1 active) |

Classification logic is in `src/lib/strategies.ts`.

---

## Supabase Schema

Three tables are required:

**`games`**

```sql
id            uuid primary key
code          text unique          -- short session code (e.g. "ALPHA7")
load          integer
running       boolean
started_at    timestamptz
created_at    timestamptz
game_duration integer              -- seconds (default 360)
max_load      integer              -- slider max (default 3000)
load_step     integer              -- slider step (default 50)
```

**`teams`**

```sql
id             uuid primary key
game_id        uuid references games(id)
name           text
color          text
cfg            jsonb
score          float8
wallet         float8
cost           float8
throughput     float8
dropped        float8
response_time  float8
cpu_percent    float8
ram_percent    float8
deployed       boolean
over_budget    boolean
last_seen      timestamptz
created_at     timestamptz
```

**`load_snapshots`**

```sql
id           bigserial primary key
game_id      uuid references games(id)
load         integer
recorded_at  timestamptz default now()
```

Used by the leaderboard to render the live load history graph (last 120 data points).

Enable Realtime on `games`, `teams`, and `load_snapshots` in the Supabase dashboard.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx               # Landing page
│   ├── create/page.tsx        # Create new private session
│   ├── session/[code]/        # Host console + live leaderboard
│   ├── join/[code]/           # Student team view
│   └── not-found.tsx          # 404 page
├── components/
│   ├── ArchitectureViz        # Live topology diagram
│   ├── BackButton             # Unified back-to-home link
│   ├── Bar                    # Utilization bar component
│   ├── ConfirmModal           # Custom confirmation dialog
│   ├── LangToggle             # DE/EN switcher + dark/light toggle
│   ├── Slider                 # Config slider
│   ├── StrategyPanel          # Strategy classification overlay
│   └── Toggle                 # Boolean toggle
└── lib/
    ├── simulation.ts          # Core M/M/1 simulation model
    ├── strategies.ts          # Strategy classification logic
    ├── session-codes.ts       # Unique session code generator
    ├── defaults.ts            # Default game and team config
    ├── supabase.ts            # Supabase client setup
    ├── types.ts               # Shared TypeScript types
    ├── i18n.ts                # DE/EN translations
    ├── lang-context.tsx       # Language context provider
    └── theme-context.tsx      # Dark/light theme provider
```

---

## Educational Context

This game is built for the **ASE2 — Scalability / Large-Scale Software** module at ZHAW and is inspired by concepts from:

- _Bondi, A. B. (2000). Characteristics of scalability and their impact on performance_ — the strategy classification (vertical, load-balanced, sharded) maps directly to Bondi's structural scalability dimensions.
- _Winters, T., Manshreck, T., Wright, H. (2020). Software Engineering at Google_ — used as a reference for scaling tradeoffs discussed in the module.
