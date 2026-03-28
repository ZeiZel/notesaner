# Notesaner Performance Budgets

Canonical source of truth for performance expectations across the stack. Every threshold listed here is enforced in CI via the benchmark suite (`scripts/benchmark.ts`) and must pass before a PR merges.

## API Performance Budgets (Backend)

All latencies are measured at the p95 percentile under the specified load.

### Notes CRUD

| Endpoint                                | Method             | p95 Budget | p99 Budget | Notes                              |
| --------------------------------------- | ------------------ | ---------- | ---------- | ---------------------------------- |
| `/workspaces/:id/notes`                 | POST               | < 100ms    | < 200ms    | Create note (FS write + DB insert) |
| `/workspaces/:id/notes/:noteId`         | GET                | < 100ms    | < 200ms    | Single note lookup                 |
| `/workspaces/:id/notes/:noteId/content` | GET                | < 100ms    | < 200ms    | Raw markdown content               |
| `/workspaces/:id/notes/:noteId`         | PATCH              | < 100ms    | < 200ms    | Partial update                     |
| `/workspaces/:id/notes/:noteId`         | DELETE             | < 100ms    | < 200ms    | Soft delete (trash)                |
| `/workspaces/:id/notes/:noteId`         | DELETE (permanent) | < 100ms    | < 200ms    | Hard delete + FS cleanup           |

### Notes Listing and Navigation

| Endpoint                                  | Method | p95 Budget | p99 Budget | Notes                             |
| ----------------------------------------- | ------ | ---------- | ---------- | --------------------------------- |
| `/workspaces/:id/notes`                   | GET    | < 100ms    | < 200ms    | Paginated list (20 items default) |
| `/workspaces/:id/notes?limit=100`         | GET    | < 100ms    | < 300ms    | Large page                        |
| `/workspaces/:id/notes/graph`             | GET    | < 100ms    | < 300ms    | Graph data (nodes + edges)        |
| `/workspaces/:id/notes/:noteId/backlinks` | GET    | < 100ms    | < 200ms    | Backlinks for a note              |
| `/workspaces/:id/notes/:noteId/versions`  | GET    | < 100ms    | < 200ms    | Version history                   |

### Search

| Endpoint                                    | Method | p95 Budget | p99 Budget | Notes                                |
| ------------------------------------------- | ------ | ---------- | ---------- | ------------------------------------ |
| `/workspaces/:id/search?q=...`              | GET    | < 500ms    | < 1000ms   | Full-text search with PostgreSQL FTS |
| `/workspaces/:id/search/suggest?prefix=...` | GET    | < 100ms    | < 200ms    | Typeahead suggestions                |
| `/workspaces/:id/search/fuzzy?q=...`        | GET    | < 500ms    | < 1000ms   | Fuzzy search via pg_trgm             |

### Workspaces

| Endpoint                  | Method | p95 Budget | p99 Budget | Notes                  |
| ------------------------- | ------ | ---------- | ---------- | ---------------------- |
| `/workspaces`             | POST   | < 100ms    | < 200ms    | Create workspace       |
| `/workspaces`             | GET    | < 100ms    | < 200ms    | List user workspaces   |
| `/workspaces/:id`         | GET    | < 100ms    | < 200ms    | Get workspace details  |
| `/workspaces/:id/members` | GET    | < 100ms    | < 200ms    | List workspace members |

---

## Database Performance Budgets

Measured at the query-building and result-mapping level. When running against a live PostgreSQL instance, budgets include network round-trip to the database.

| Operation                                          | p95 Budget | Notes                        |
| -------------------------------------------------- | ---------- | ---------------------------- |
| Single-row CRUD (findById, create, update, delete) | < 50ms     | Query building + row mapping |
| Paginated list (20 items)                          | < 100ms    | Cursor-based pagination      |
| Paginated list (100 items)                         | < 100ms    | Max page size                |
| Full-text search (20 results)                      | < 500ms    | Includes snippet generation  |
| Typeahead suggest (10 results)                     | < 100ms    | ts_stat prefix match         |
| Bulk move (50 notes)                               | < 200ms    | Batch UPDATE                 |
| Bulk tag assignment (100 notes x 3 tags)           | < 200ms    | Batch INSERT                 |
| Frontmatter parse + merge (100 notes)              | < 100ms    | JSON parse/stringify cycle   |

### Index Requirements

Queries must use indexes. Sequential scans on tables with more than 10K rows are performance bugs.

Required indexes:

- `notes.id` (PK)
- `notes.workspace_id` (FK, used in every workspace-scoped query)
- `notes.search_vector` (GIN, for FTS)
- `notes.path` (for filesystem-path lookups)
- `notes.title` (pg_trgm GIN, for fuzzy search)
- `notes.created_at`, `notes.updated_at` (for sorting)
- `workspace_members.workspace_id, user_id` (composite)

---

## Frontend Performance Budgets (Core Web Vitals)

Based on Google's "good" thresholds. Measured via Lighthouse CI.

### Core Web Vitals

| Metric                         | Budget  | Description                                |
| ------------------------------ | ------- | ------------------------------------------ |
| LCP (Largest Contentful Paint) | < 2.5s  | Time until the main content is visible     |
| FID (First Input Delay)        | < 100ms | Time until the page responds to user input |
| CLS (Cumulative Layout Shift)  | < 0.1   | Visual stability (no content jumping)      |

### Additional Metrics

| Metric                       | Budget  | Description                               |
| ---------------------------- | ------- | ----------------------------------------- |
| FCP (First Contentful Paint) | < 1.5s  | First visual feedback                     |
| TTI (Time to Interactive)    | < 3.5s  | Fully interactive                         |
| SI (Speed Index)             | < 3.0s  | How quickly content is visually populated |
| TBT (Total Blocking Time)    | < 200ms | Time the main thread is blocked           |

### Resource Budgets (compressed)

| Resource Type       | Size Budget | Count Budget |
| ------------------- | ----------- | ------------ |
| JavaScript          | < 300KB     | < 15 files   |
| CSS                 | < 50KB      | < 5 files    |
| Images              | < 500KB     | < 20 files   |
| Fonts               | < 100KB     | < 4 files    |
| Total page weight   | < 1MB       | --           |
| Third-party scripts | --          | < 5          |

### Lighthouse Score Targets

| Category       | Minimum Score |
| -------------- | ------------- |
| Performance    | >= 90         |
| Accessibility  | >= 90         |
| Best Practices | >= 90         |

---

## Editor Performance Budgets

The editor must maintain 60fps responsiveness during normal editing operations.

### Keystroke Latency

| Operation                              | p95 Budget | Notes              |
| -------------------------------------- | ---------- | ------------------ |
| Single character insert (1K-line doc)  | < 16ms     | 60fps frame budget |
| Single character insert (10K-line doc) | < 16ms     | Large document     |
| Paste 100 characters (10K-line doc)    | < 16ms     | Bulk insert        |
| Delete 50 characters (10K-line doc)    | < 16ms     | Selection delete   |
| Undo single operation (10K-line doc)   | < 16ms     | Undo manager       |
| Redo single operation (10K-line doc)   | < 16ms     | Redo manager       |

### Document Operations

| Operation                           | p95 Budget | Notes                        |
| ----------------------------------- | ---------- | ---------------------------- |
| Open 1K-line document               | < 200ms    | Parse frontmatter + init Yjs |
| Open 10K-line document              | < 1000ms   | Large document loading       |
| Serialise 1K-line doc to markdown   | < 10ms     | Save operation               |
| Serialise 10K-line doc to markdown  | < 50ms     | Large save                   |
| Extract wikilinks from 10K-line doc | < 50ms     | Link graph update            |
| Parse simple frontmatter            | < 5ms      | 4-5 fields                   |
| Parse large frontmatter (50 fields) | < 10ms     | Complex metadata             |

---

## Sync (Yjs CRDT) Performance Budgets

Real-time collaboration must feel instantaneous for typical editing.

### Update Propagation

| Operation                                                      | p95 Budget | Notes                    |
| -------------------------------------------------------------- | ---------- | ------------------------ |
| Single update apply (empty doc)                                | < 10ms     | New document first edit  |
| Single update apply (1K-line doc)                              | < 10ms     | Normal document          |
| Single keystroke propagation (encode + apply + broadcast prep) | < 5ms      | End-to-end per keystroke |
| Full update propagation (client to all peers)                  | < 200ms    | Including network        |

### Multi-Client Merge

| Scenario                   | p95 Budget | Notes                 |
| -------------------------- | ---------- | --------------------- |
| 5 clients x 10 edits each  | < 50ms     | Typical collaboration |
| 10 clients x 20 edits each | < 100ms    | Heavy collaboration   |

### Large Document Operations

| Operation                               | p95 Budget | Notes              |
| --------------------------------------- | ---------- | ------------------ |
| Encode state vector (10K lines)         | < 100ms    | Sync handshake     |
| Encode full state update (10K lines)    | < 100ms    | Initial sync       |
| Compute diff from empty SV (10K lines)  | < 100ms    | New client joining |
| Apply full state to new doc (10K lines) | < 100ms    | Client restore     |

### Reconnection

| Scenario                           | p95 Budget | Notes                |
| ---------------------------------- | ---------- | -------------------- |
| Reconnect with 10 pending updates  | < 200ms    | Short offline period |
| Reconnect with 100 pending updates | < 200ms    | Extended offline     |

### Frontmatter Conflict Resolution

| Scenario                    | p95 Budget | Notes               |
| --------------------------- | ---------- | ------------------- |
| 10 conflicting fields       | < 5ms      | Per-field LWW       |
| 50 fields (mixed conflicts) | < 10ms     | Complex frontmatter |

### Persistence

| Operation                           | p95 Budget | Notes                 |
| ----------------------------------- | ---------- | --------------------- |
| Base64 encode/decode (1K-line doc)  | < 50ms     | Valkey storage        |
| Base64 encode/decode (10K-line doc) | < 200ms    | Large doc persistence |

---

## Component Render Performance Budgets

All operations must complete within a single 16ms frame budget to maintain 60fps.

| Operation                               | p95 Budget | Notes                       |
| --------------------------------------- | ---------- | --------------------------- |
| Note list store update (100 items)      | < 16ms     | Sort + filter + render prep |
| Note list store update (1000 items)     | < 50ms     | Large vault                 |
| Note list search (1000 items)           | < 50ms     | Client-side filter          |
| Sidebar tree flatten (500 nodes)        | < 16ms     | Recursive tree walk         |
| Sidebar toggle + re-flatten             | < 16ms     | User interaction            |
| Search results processing (20 results)  | < 16ms     | Sort + group                |
| Search results processing (100 results) | < 16ms     | Large result set            |
| Editor state preparation                | < 16ms     | Props derivation            |
| Workspace state hydration               | < 10ms     | Initial load                |
| Virtualised list window (5000 items)    | < 16ms     | Scroll position calculation |

---

## How Budgets Are Enforced

### In CI (Pull Requests)

1. `scripts/benchmark.ts` runs all benchmark suites
2. Results are output as JSON
3. CI compares against the budgets in this document
4. PRs that exceed any p95 budget are blocked

### Running Locally

```bash
# Run all benchmarks
npx tsx scripts/benchmark.ts

# Run specific suite
npx tsx scripts/benchmark.ts --suite=api
npx tsx scripts/benchmark.ts --suite=database
npx tsx scripts/benchmark.ts --suite=sync
npx tsx scripts/benchmark.ts --suite=editor
npx tsx scripts/benchmark.ts --suite=render

# Run Lighthouse CI
npx tsx scripts/benchmark.ts --suite=lighthouse

# Output JSON only (for scripting)
npx tsx scripts/benchmark.ts --json
```

### Updating Budgets

Budgets should only be relaxed when:

1. A new feature fundamentally changes the performance characteristics
2. The relaxation is discussed and approved in a PR
3. This document is updated in the same PR as the code change

Budgets should be tightened when:

1. An optimisation measurably improves performance
2. The new tighter budget is consistently met across 3+ CI runs

---

## Monitoring in Production

Performance budgets are also enforced at runtime via:

- **OpenTelemetry traces**: p95/p99 latency per endpoint
- **Prometheus histograms**: Request duration bucketed by endpoint
- **Lighthouse CI**: Scheduled runs against staging/production
- **Real User Monitoring (RUM)**: Core Web Vitals from actual users

Alerting thresholds are set at 2x the budget values to catch regressions before users notice.
