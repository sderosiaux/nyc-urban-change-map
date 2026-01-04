-- Enable required PostgreSQL extensions

-- PostGIS for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigram similarity for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify PostGIS is working
SELECT PostGIS_Version();
