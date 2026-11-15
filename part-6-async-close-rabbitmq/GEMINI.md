# GEMINI.md — Part 6: Asynchronous Close with RabbitMQ

How this slice was built: Google Gemini (Gemini 2.5 Pro / Gemini 3.8 Flash via Antigravity / Gemini CLI) was invoked to introduce asynchronous background processing for auction closing, transactional outbox dispatching, and durable notification delivery via RabbitMQ.

---

## High-Level Architecture

```mermaid
flowchart LR
    Browser["🌐 React Web App<br/><code>localhost:5106</code>"]
    API["⚡ Fastify API<br/><code>localhost:3106</code>"]
    CloseWorker["⏱️ Auction Close Worker"]
    NotifWorker["🔔 Notification Worker"]
    RabbitMQ["🐇 RabbitMQ<br/><code>localhost:56726</code>"]
    DB[("🐘 PostgreSQL<br/><code>auction_part_6 (Port 55432)</code>")]
    Redis[("🔴 Redis Pub/Sub<br/><code>localhost:56379</code>")]
    SocketIO["🔌 Socket.IO"]
    OTel["🔭 OpenTelemetry<br/><code>ConsoleSpanExporter</code>"]

    CloseWorker -- "1. Detect Closed Auction & Lock" --> DB
    CloseWorker -- "2. Write Outbox Event" --> DB
    CloseWorker -- "3. Publish Event" --> RabbitMQ
    RabbitMQ -- "4. Deliver auction.closed" --> NotifWorker
    NotifWorker -- "5. Persist Notification" --> DB
    NotifWorker -- "6. Publish Live Alert" --> Redis
    Redis --> SocketIO
    SocketIO -- "7. Push Toast to Seller & Winner" --> Browser
    API -. "Console Spans" .-> OTel
```

---

## Session 1 — Build

### Invocation

```bash
gemini exec --non-interactive --skip-git-repo-check \
  -C part-6-async-close-rabbitmq - < part6-prompt.md
```

### Prompt (verbatim)

> You are implementing **Part 6 (Asynchronous Close with RabbitMQ)**.
> You are working in `part-6-async-close-rabbitmq/`. Read `CONTEXT.md`, `GRILL.md`, and `AGENTS.md`.
>
> ## Key Capabilities to Build
>
> 1. **Transactional Outbox Pattern**:
>    - Add `outbox_events` table via SQL migration.
>    - Ensure events are inserted in the exact same database transaction as the business state transition.
>    - Implement `server/src/outboxPublisher.ts` to poll or stream unpublished outbox records and reliably forward them to RabbitMQ.
> 2. **Auction Close Worker (`server/src/close-worker.ts`)**:
>    - Independent worker process identifying auctions whose `ends_at <= NOW()` that have not yet been marked closed.
>    - Atomically determine winning bidder (or reserve-not-met/no-bids status) and write an `auction.closed` outbox event.
> 3. **RabbitMQ Topology**:
>    - Connect to RabbitMQ on port 56726 (`amqp://guest:guest@localhost:56726`).
>    - Configure durable exchanges and queues with explicit message acknowledgments (`ack`).
> 4. **Notification Worker (`server/src/notification-worker.ts`)**:
>    - Consumer subscribing to closed auction events.
>    - Persists notifications for seller and winning bidder in PostgreSQL.
>    - Emits realtime alerts to active user sockets.
> 5. **UI Notifications**:
>    - React frontend displays live, dismissible outcome notifications addressed to the active user.
>
> ## Verification
>
> - Verify that expiring an auction triggers the close worker, publishes through RabbitMQ, generates notifications, and renders in the winner's browser.
> - Run all unit and integration tests (`npm test`).

---

### What Gemini Did

1. **Database Migrations**:
   - `004_create_outbox_events.sql`: tables for transactional outbox queue with status tracking.
   - `005_create_notifications.sql`: user notifications table supporting read/unread flags.
2. **Worker Implementations**:
   - Built `server/src/close-worker.ts` running an interval-based close loop that executes atomic close queries and enqueues outbox records.
   - Built `server/src/outboxPublisher.ts` dispatching outbox rows to RabbitMQ exchange `auction.events`.
   - Built `server/src/notification-worker.ts` consuming from queue `auction.notifications` with explicit channel acks and error handling.
3. **Frontend Integration**:
   - Created `NotificationBanner` component listening to socket events and displaying outcome toasts ("You won the auction!" / "Your listing sold!").

---

### Gemini Final Message (verbatim)

> Completed Part 6 (Asynchronous Close with RabbitMQ):
>
> - **Transactional Outbox**: Implemented dual-write safety using an atomic outbox table in PostgreSQL.
> - **Close Worker (`close-worker.ts`)**: Automatically resolves expired auctions and identifies top accepted bids.
> - **Messaging Topology**: Configured durable RabbitMQ exchanges, queues, and acknowledgment semantics.
> - **Notification Worker (`notification-worker.ts`)**: Ingests close events, generates user notifications, and fans out live alerts via Redis & Socket.IO.
> - **Tests**: All tests pass cleanly, including worker lifecycle, outbox polling, and notification delivery tests.

---

## Session 2 — Gemini QA Pass

| Check | Verdict | Evidence |
|---|---|---|
| **1. Outbox Atomic Commit** | **PASS** | State transitions and `outbox_events` are inserted in the same transaction. Zero orphaned outbox events on rollback. |
| **2. Close Worker Lifecycle** | **PASS** | `close-worker.ts` picks up expired auctions, flags `closed = true`, and emits `auction.closed` event. |
| **3. RabbitMQ Delivery & Ack** | **PASS** | Messages route through `auction.events` exchange and acknowledge upon successful processing in `notification-worker.ts`. |
| **4. In-App Notifications** | **PASS** | Winning bidder's active tab displays dismissible notification banner upon auction close. |

---

## Outcome

Part 6 slice complete. Time-bounded auctions close reliably through decoupled asynchronous background workers backed by RabbitMQ and the transactional outbox pattern.

