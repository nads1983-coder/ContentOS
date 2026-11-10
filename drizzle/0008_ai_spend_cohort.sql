-- Existing usage cannot be reliably reclassified after subscription changes.
ALTER TABLE contentos_app.ai_spend_requests ADD COLUMN customer_cohort text NOT NULL DEFAULT 'unknown'
  CHECK (customer_cohort IN ('unknown','lifetime','subscription','other'));
