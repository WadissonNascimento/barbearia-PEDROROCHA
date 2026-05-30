CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RateLimitBucket_keyHash_key"
ON "RateLimitBucket"("keyHash");

CREATE INDEX IF NOT EXISTS "RateLimitBucket_scope_resetAt_idx"
ON "RateLimitBucket"("scope", "resetAt");

CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx"
ON "RateLimitBucket"("resetAt");

ALTER TABLE public."RateLimitBucket" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."RateLimitBucket" FROM anon;
REVOKE ALL ON TABLE public."RateLimitBucket" FROM authenticated;
