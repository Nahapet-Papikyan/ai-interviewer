-- Additive, backward-compatible interview reliability columns.
-- Existing interviews keep their messages and facts.
-- Old facts default to CONFIRMED.

DO $$ BEGIN
  CREATE TYPE "FactStatus" AS ENUM ('CONFIRMED', 'UNCERTAIN', 'INFERRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "InterviewFact"
  ADD COLUMN IF NOT EXISTS "status" "FactStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rawTranscript" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceRole" TEXT NOT NULL DEFAULT 'user';

ALTER TABLE "InterviewMessage"
  ADD COLUMN IF NOT EXISTS "providerEventId" TEXT;

CREATE INDEX IF NOT EXISTS "InterviewMessage_interviewId_providerEventId_idx"
  ON "InterviewMessage" ("interviewId", "providerEventId");

ALTER TABLE "Interview"
  ALTER COLUMN "promptVersion" SET DEFAULT 'interviewer-v2';
