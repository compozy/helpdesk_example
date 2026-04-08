-- Run against existing databases (e.g. docker exec -i ... psql < add_ticket_sentiment.sql)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_sentiment_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_sentiment_check
  CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative'));
