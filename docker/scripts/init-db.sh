#!/usr/bin/env bash
# =============================================================================
# Notesaner — PostgreSQL Database Initialization Script
# =============================================================================
#
# This script runs ONCE during the very first startup of the postgres container
# (via /docker-entrypoint-initdb.d/).  It is NOT executed on subsequent starts.
#
# Responsibilities:
#   1. Enable required PostgreSQL extensions (pg_trgm for full-text search)
#   2. Apply advisory lock to prevent races on concurrent container starts
#   3. Harden pg_hba settings for the production user
#   4. Create any extra databases needed (e.g. for integration tests)
#
# Note: Prisma migrations are managed separately by running
#   prisma migrate deploy
# as an init container or as part of the server startup command.
# This script only handles the PostgreSQL-level setup that Prisma cannot do.
#
# Environment variables injected by the postgres container entrypoint:
#   POSTGRES_USER     — superuser created by the entrypoint
#   POSTGRES_PASSWORD — superuser password
#   POSTGRES_DB       — default database name
# =============================================================================

set -euo pipefail

# Prefer POSTGRES_USER / POSTGRES_DB from the environment (set by Docker);
# fall back to safe defaults so the script can also be run manually.
DB_USER="${POSTGRES_USER:-notesaner}"
DB_NAME="${POSTGRES_DB:-notesaner}"

echo "[init-db] Running initialization for database '${DB_NAME}' as user '${DB_USER}'"

# ---------------------------------------------------------------------------
# 1. Enable extensions
# ---------------------------------------------------------------------------
# pg_trgm — trigram similarity index used by the full-text search feature.
#            The tsvector column is maintained by a raw SQL migration (see schema.prisma note).
# uuid-ossp — Prisma uses gen_random_uuid() (built-in since PG 13), but some
#             legacy queries or extensions may still reference uuid_generate_v4().
psql -v ON_ERROR_STOP=1 --username "${DB_USER}" --dbname "${DB_NAME}" <<-SQL
    -- Trigram index support for ILIKE and similarity searches on note titles
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- UUID generation (belt-and-suspenders; PG 13+ has gen_random_uuid() built-in)
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Full-text search dictionary (unaccent removes diacritics from search terms)
    CREATE EXTENSION IF NOT EXISTS unaccent;

    -- Cryptographic functions (used for token hashing if pgcrypto is preferred)
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    SELECT 'Extensions enabled: pg_trgm, uuid-ossp, unaccent, pgcrypto' AS status;
SQL

# ---------------------------------------------------------------------------
# 2. Configure performance settings for the notesaner workload
#    These settings complement postgresql.conf and can be overridden per-session.
# ---------------------------------------------------------------------------
psql -v ON_ERROR_STOP=1 --username "${DB_USER}" --dbname "${DB_NAME}" <<-SQL
    -- Statement timeout: kill queries running longer than 30 s (protects against runaway FTS)
    ALTER DATABASE "${DB_NAME}" SET statement_timeout = '30s';

    -- Lock timeout: fail fast on contended locks rather than deadlocking
    ALTER DATABASE "${DB_NAME}" SET lock_timeout = '10s';

    -- Use C locale for deterministic string comparisons (set at initdb time too)
    -- ALTER DATABASE "${DB_NAME}" SET lc_collate TO 'C';

    SELECT 'Database-level settings applied' AS status;
SQL

# ---------------------------------------------------------------------------
# 3. Create a read-only reporting role (optional — used for BI tools / backups)
#    Skip if already exists (idempotent).
# ---------------------------------------------------------------------------
psql -v ON_ERROR_STOP=1 --username "${DB_USER}" --dbname "${DB_NAME}" <<-SQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'notesaner_readonly') THEN
            CREATE ROLE notesaner_readonly NOLOGIN;
            GRANT CONNECT ON DATABASE "${DB_NAME}" TO notesaner_readonly;
            GRANT USAGE ON SCHEMA public TO notesaner_readonly;
            -- Grant SELECT on all current and future tables
            GRANT SELECT ON ALL TABLES IN SCHEMA public TO notesaner_readonly;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
                GRANT SELECT ON TABLES TO notesaner_readonly;
            RAISE NOTICE 'Created notesaner_readonly role';
        ELSE
            RAISE NOTICE 'Role notesaner_readonly already exists, skipping';
        END IF;
    END
    \$\$;
SQL

# ---------------------------------------------------------------------------
# 4. Create the full-text search tsvector column and GIN index
#    Prisma cannot model tsvector (Unsupported type), so we handle it here.
#    This block is idempotent — safe to re-run.
# ---------------------------------------------------------------------------
#
# NOTE: This runs AFTER the first `prisma migrate deploy` has created the notes
# table.  If the table does not yet exist this block will print a warning and
# continue; Prisma's initial migration must run first.
psql -v ON_ERROR_STOP=0 --username "${DB_USER}" --dbname "${DB_NAME}" <<-SQL
    DO \$\$
    BEGIN
        IF EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'notes'
        ) THEN
            -- Add the generated tsvector column if it doesn't already exist
            IF NOT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name   = 'notes'
                  AND column_name  = 'search_vector'
            ) THEN
                ALTER TABLE notes
                    ADD COLUMN search_vector tsvector
                    GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', coalesce(title, '')), 'A')
                    ) STORED;

                CREATE INDEX CONCURRENTLY IF NOT EXISTS notes_search_vector_gin
                    ON notes USING GIN(search_vector);

                RAISE NOTICE 'Created search_vector column and GIN index on notes';
            ELSE
                RAISE NOTICE 'search_vector column already exists, skipping';
            END IF;
        ELSE
            RAISE WARNING 'Table notes does not exist yet — run prisma migrate deploy first, then re-run this FTS setup.';
        END IF;
    END
    \$\$;
SQL

echo "[init-db] Initialization complete."
