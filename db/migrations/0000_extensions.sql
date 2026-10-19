-- Extensiones que necesita el modelo de datos: PostGIS (geografía) y citext (emails sin distinguir mayúsculas)
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS citext;
