# AGENTS.md

## Project Overview

Endure-O-Matic is a web application that helps users plan and track their team or solo endurance events. It is designed to be used by athletes of all levels, from beginners to professionals. It is a **team organisation and tracking helper**, not an official results tool.

The problem this application solves is predicted start times of each lap of an event for each team member.

The format of the events is a series of laps, each with a start time and a duration. Each lap is assigned to a team member. The application should be able to calculate the predicted start time of each lap for each team member. The predicted start time of a lap is the predicted start time of the previous lap plus the duration of the previous lap. The predicted start time of the first lap is the start time of the first lap.

The order that the team members complete their laps in will vary, though will usualy start with each team member completing their first lap in order. Beyond that, some team members may drop out at any point and compete no further laps. This means that the order that the team members complete their laps in will vary. Some team members may complete multiple laps in a row. There is also the possibility of a guest who is not officially part of the team but is completing a lap for the team. This can be indicated by a guest flag.

As well as allowing the planning and tracking of laps, the application should also show other interesting statistics, e.g. the percentage completed, the number of laps completed, who has completed how many laps, average lap time per team member and across the whole team. The UI should be clean and modern and easy to use.

An event should be able to be created and then shared with other users. This will have a start and end time, for example a 24 hour event. It's possible for a team member to start their lap at any time during the event but they cannot start a new lap after the event has ended.  Though they can continue a lap after the event has ended and it will still count as a completed lap.

The application shouldn't require any login, just a shareable link to an event. 

### Event-Team Structure

Events are **pre-populated server-side configurations** (not user-created). Users create **teams** within an event. Each team gets its own Yjs document, edit/view tokens, and operates independently.

- **Pre-populated events**: Defined in `server/index.ts` as the `EVENTS` array. First entry: "Endure 24" (June 6, 2026 12:00 → June 7, 2026 12:00).
- **Teams**: User-created via `POST /api/teams` with `{ eventId, teamName }`. Each team gets an `editToken` and `readToken`.
- **URLs**: `/team/edit/:editToken` (full access) and `/team/view/:readToken` (read-only).

### Sharing & Access

There are two types of shareable links, **specific to each team** (not the event):

- **Edit link** — `/team/edit/:editToken` — Anyone with this link can view and edit the team's data (intended for team members). The edit link gives full access to add/remove laps, mark laps as started/completed, modify team members, etc.
- **Read-only link** — `/team/view/:readToken` — Anyone with this link can view the team's data but cannot make changes. Useful for spectators, family, and supporters.

No login or authentication is required. Access is controlled purely by which link a user has.

### Lap Definition

- A lap is always the **same fixed distance/course** for all team members. This means lap times are directly comparable across team members.
- Each lap has a single assignee (team member or named guest).

### Lap Constraints

- **Single active lap**: Only one team member can be running a lap at a time. The "Start" button is disabled while another lap is active.
- **Member reorder lock**: Members who have completed laps or are currently running a lap cannot be reordered in the rotation. A 🔒 badge indicates locked members.
- **Editable times**: Click any lap duration to edit it inline:
  - Completed laps: edit `actualDuration` (corrections)
  - Planned/active laps: edit `predictedDuration`

### Lap Duration Prediction

Lap durations are **predicted** based on previous performance by the same team member:

- Before the event begins, an **estimated lap time** can be set per team member. This is used for initial schedule predictions.
- For subsequent laps, the predicted duration is based on the time taken to complete previous laps by that team member.
- The prediction model should account for **fatigue** — times are expected to increase as the event progresses. A simple fatigue factor (e.g., a percentage slowdown per completed lap) should be applied to extrapolate realistic future times.
- Once a lap is completed, the **actual duration** replaces the prediction and is used to refine future predictions.

### Unified Laps & Schedule View

Laps and the predicted schedule are shown in a **single unified view** (one tab, not two separate tabs):

- **Top**: Active lap banner (if running) with live timer
- **Middle**: Tracked laps table with status, times, and actions
- **Bottom**: "📅 Predicted Upcoming" section showing the next 20 predicted laps in a timeline format

The two tabs in the app are: **🏁 Laps & Schedule** and **👥 Team**.

### Planning & Live Mode

There is no separate "planning" vs "live" mode — it is a **single unified view**. Before the event starts, all times are predicted based on estimated lap times. Once the event is underway, completed laps show actual times and future laps show updated predictions based on real performance data. The transition is seamless.

### Event Format

- Events are **time-boxed** (e.g., 24 hours) with a defined start and end time.
- There is **no fixed number of laps** — teams complete as many laps as possible within the time window.
- A team member can start a lap at any time during the event but **cannot start a new lap after the event has ended**.
- A lap that is in progress when the event ends **still counts** as a completed lap.
- Team sizes range from **1 to 8 members**.

### Event Lifecycle

- Events remain **fully editable after the event ends** — corrections, additions, and adjustments can be made at any time.
- There is no concept of "locking" or "archiving" an event. The shareable links continue to work indefinitely.
- Data can be exported (JSON/Markdown) at any point for record-keeping.

### Statistics & Percentage

- **Percentage completed** is based on the total event time elapsed, excluding any time spent completing a lap after the event finish time. For example, in a 24-hour event, after 12 hours the event is 50% complete.
- Other statistics include: number of laps completed, laps per team member, average lap time per team member, average lap time across the whole team.

### Guest Laps

- Guests are **tracked separately** from team members.
- Guests can be **named** (e.g., "Sarah - guest").
- Guest lap data does **not** affect the predictions of the team member they may be substituting for.

## Architecture

The architecture should be kept as simple as possible as this is a relatively small project. It should be built using modern web technologies and should be mobile-first. It's critical that it can operate offline or with poor connectivity. There will need to be the ability to sync data when connectivity is restored and it needs to support multiple users (within a team) to view and edit the same data. The UI should be clean and modern and easy to use. It should be built using a component-based architecture and should be fully responsive.

### Tech Stack

- **Frontend**: React + TypeScript with Vite (`vite-plugin-pwa` for service worker)
- **Backend**: Node.js + Express + TypeScript (`tsx` for dev, compiled for prod)
- **Real-time sync**: Yjs (CRDTs) with custom WebSocket sync protocol
- **Client persistence**: `y-indexeddb`
- **Server persistence**: `y-leveldb` + JSON token store
- **Build**: Single Docker container serving static assets + WebSocket

### Key Source Files

| File | Purpose |
|---|---|
| `server/index.ts` | Express server, WebSocket Yjs sync, pre-populated events, team CRUD API, export endpoints |
| `src/shared/types.ts` | `EventConfig`, `TeamData`, `TeamMember`, `Lap`, `LapStatus`, `ScheduleEntry`, `EventStats`, `MemberStats`, `AccessMode` |
| `src/hooks/useYjsDocument.ts` | Yjs doc management, WebSocket connection, IndexedDB persistence, CRUD operations, constraint helpers (`canReorderMember`, `hasActiveLap`) |
| `src/pages/HomePage.tsx` | Event selection dropdown → team creation form → shareable links |
| `src/pages/TeamPage.tsx` | Main team view with 2 tabs (Laps & Schedule, Team), stats bar, export/share footer |
| `src/components/LapList.tsx` | Unified laps + predicted schedule view, inline time editing, single-active-lap constraint |
| `src/components/TeamPanel.tsx` | Member management with reorder constraints |
| `src/components/StatsBar.tsx` | Progress bar, lap count, fastest/average times, top members |
| `src/components/ShareLinks.tsx` | Team-specific copyable edit/view URLs |
| `src/components/ExportMenu.tsx` | JSON and Markdown export buttons |
| `src/shared/statistics.ts` | Event stats calculation (uses `EventLike` interface) |
| `src/shared/prediction.ts` | Lap duration prediction with fatigue model, schedule generation |
| `src/shared/export.ts` | Client-side JSON/Markdown export formatters |
| `src/index.css` | Dark theme, glassmorphism, responsive design, all component styles |
| `src/App.tsx` | Routes: `/`, `/team/edit/:token`, `/team/view/:token` |

### Data Synchronisation (CRDTs)

The application uses **CRDTs (Conflict-free Replicated Data Types)** for data synchronisation. CRDTs are data structures that can be replicated across multiple nodes, modified independently and concurrently, and then merged back together without conflicts — no central coordination or consensus protocol is required.

**Why CRDTs are a good fit for this project:**

- **Offline-first** — Each client maintains a full local copy of the data. Edits happen instantly against the local state, with no server round-trip required.
- **Automatic conflict resolution** — When multiple team members edit the event simultaneously (e.g., one marks a lap complete while another adds a new lap), CRDTs guarantee that all clients converge to the same state without manual conflict resolution.
- **Eventual consistency** — When connectivity is restored, changes are synced and merged automatically. No "last write wins" data loss.

### Data Persistence & Export

- **Server persistence** — The CRDT document state should be persisted to disk on the server (e.g., using y-leveldb or file-based storage) so that events survive server restarts.
- **JSON export** — Event data should be exportable to a **JSON file** that captures the full state and can be used to restore all data if necessary.
- **Markdown export** — Event data should also be exportable as a **Markdown summary** for easy sharing and archiving (e.g., final results, lap times per member, overall statistics).
- **Client persistence** — Each client persists the CRDT state in IndexedDB for offline access.
- **Real-time collaboration** — Changes can be broadcast to other clients in near-real-time over WebSockets, giving the app a collaborative feel similar to Google Docs.

**Recommended library: [Yjs](https://yjs.dev/)** — A mature, battle-tested CRDT implementation for JavaScript/TypeScript. It supports:
- Shared types (Map, Array, Text) that map well to the event data model
- Multiple sync providers (WebSocket, WebRTC, IndexedDB for persistence)
- Small wire format for efficient syncing
- Offline support out of the box

### PWA (Progressive Web App)

The application should be built as a **PWA** so that it:

- Can be installed on a user's home screen on mobile devices
- Works fully offline via a service worker that caches the app shell and static assets
- Syncs data in the background when connectivity is restored
- Provides push notification capability for future features (e.g., "Your lap is coming up next!")

### Real-Time Updates

The app should provide **near-real-time updates** to all connected clients. When one team member makes a change (e.g., starts or completes a lap), all other connected clients should see the update within seconds. This will be achieved via **WebSocket** connections used by the CRDT sync provider.

### Deployment

The application will be **self-hosted using Docker**:

- A `Dockerfile` should build both the frontend and backend into a single container (Node.js server serving the React PWA static assets and handling WebSocket connections).
- A `docker-compose.yml` should be provided for easy deployment, including a volume mount for persisting CRDT data across container restarts.
- The container should expose a single port (e.g., `3000`) for both HTTP and WebSocket traffic.
- A reverse proxy (e.g., Nginx, Traefik, Caddy) is assumed to be managed by the user externally for HTTPS termination and domain routing.

## Development Guidelines

Modern web development standards should be followed where possible. It does not need to support very old phones and browsers.

TypeScript should be used for all code. NodeJs can be used for the backend and React should be used for the frontend. 

## Setup

### Development

```bash
npm install
npm run dev    # Starts Vite dev server (port 5173) + backend server (port 3000)
```

The Vite dev server proxies `/api` and `/ws` to the backend.

### Production (Docker)

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`. CRDT data is persisted via a Docker volume.

### Production (Manual)

```bash
npm run build     # Build frontend + compile server TS
npm run preview   # Start production server on port 3000
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events` | List all pre-populated events |
| `GET` | `/api/events/:eventId` | Get single event config |
| `POST` | `/api/teams` | Create team `{ eventId, teamName }` → `{ teamId, editToken, readToken }` |
| `GET` | `/api/teams/:token` | Get team info + event config for a token |
| `GET` | `/api/teams/:token/export/json` | Download team data as JSON |
| `GET` | `/api/teams/:token/export/markdown` | Download team summary as Markdown |

## Testing

There should be integration tests to cover various scenarios that the app must support, a sequence of events. Testing offline usage and data synchronisation is critical.

## Current Status

The application is fully functional with:
- Pre-populated events (Endure 24)
- Team creation with shareable links
- Real-time Yjs sync with offline support
- Unified laps & predicted schedule view
- Lap constraints (single active, reorder lock, inline time editing)
- PWA support (installable, offline-capable)
- Docker deployment ready
