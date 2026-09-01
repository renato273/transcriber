-- AlterTable
ALTER TABLE "Transcription" ADD COLUMN "summary" TEXT;
ALTER TABLE "Transcription" ADD COLUMN "summaryProvider" "ProviderType";

-- Preserve summaries that unambiguously belong to a single transcription.
UPDATE "Transcription" AS transcription
SET
  "summary" = session."summary",
  "summaryProvider" = session."summaryProvider"
FROM "TranscriptionSession" AS session
WHERE transcription."sessionId" = session.id
  AND session."summary" IS NOT NULL
  AND (
    SELECT COUNT(*)
    FROM "Transcription" AS sibling
    WHERE sibling."sessionId" = session.id
  ) = 1;
