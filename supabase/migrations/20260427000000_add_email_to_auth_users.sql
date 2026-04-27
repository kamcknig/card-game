-- Email registration: every auth_users row may carry a unique, case-insensitive
-- email. NULL means the user predates this feature; they will be funnelled
-- into the add-email flow at their next login. New registrations always set
-- a non-null email.
ALTER TABLE auth_users ADD COLUMN email TEXT;

-- Case-insensitive uniqueness, but only when the column is non-null. Postgres
-- treats every NULL as distinct, so multiple legacy rows with NULL email do
-- not violate this constraint.
CREATE UNIQUE INDEX auth_users_email_lower_unique ON auth_users (lower(email)) WHERE email IS NOT NULL;

-- Grant the new column to service_role so it remains accessible to the server.
GRANT ALL ON auth_users TO service_role;
