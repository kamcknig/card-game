-- Re-apply service_role grants after auth_registration_codes was dropped.
-- The original grant in the schema migration listed all four tables in one
-- statement; dropping auth_registration_codes can leave the remaining tables
-- without grants in some Postgres environments. This migration re-establishes
-- them explicitly.
GRANT ALL ON auth_users, auth_sessions, match_configuration_saves TO service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;
