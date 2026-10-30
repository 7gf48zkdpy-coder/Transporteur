CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_role AS ENUM ('CLIENT', 'DRIVER', 'ADMIN');
CREATE TYPE vehicle_type AS ENUM ('BERLINE', 'VAN', 'ELECTRIC');
CREATE TYPE booking_status AS ENUM ('REQUESTED', 'OFFERED', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role account_role NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  display_name TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE drivers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  partner_status TEXT NOT NULL DEFAULT 'PENDING',
  is_available BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(2,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id UUID NOT NULL REFERENCES drivers(user_id),
  vehicle_type vehicle_type NOT NULL,
  make TEXT,
  model TEXT,
  registration_number TEXT UNIQUE NOT NULL,
  passenger_capacity SMALLINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id UUID NOT NULL REFERENCES drivers(user_id),
  document_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  expires_at DATE,
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type vehicle_type NOT NULL,
  base_fare_cents INTEGER NOT NULL,
  per_km_cents INTEGER NOT NULL,
  per_minute_cents INTEGER NOT NULL,
  minimum_fare_cents INTEGER NOT NULL DEFAULT 1000,
  commission_basis_points INTEGER NOT NULL DEFAULT 1500,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fixed_fares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_label TEXT NOT NULL,
  destination_label TEXT NOT NULL,
  vehicle_type vehicle_type NOT NULL,
  fare_cents INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES users(id),
  driver_user_id UUID REFERENCES drivers(user_id),
  vehicle_id UUID REFERENCES vehicles(id),
  status booking_status NOT NULL DEFAULT 'REQUESTED',
  pickup_label TEXT NOT NULL,
  destination_label TEXT NOT NULL,
  distance_meters INTEGER,
  duration_seconds INTEGER,
  quoted_fare_cents INTEGER NOT NULL,
  final_fare_cents INTEGER,
  commission_cents INTEGER,
  driver_earnings_cents INTEGER,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
  provider TEXT NOT NULL,
  provider_payment_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  driver_user_id UUID NOT NULL REFERENCES drivers(user_id),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider_transfer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bookings_status_created_idx ON bookings(status, created_at DESC);
CREATE INDEX bookings_driver_created_idx ON bookings(driver_user_id, created_at DESC);
