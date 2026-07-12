-- Supabase Schema for PLINTH
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table for Plots
create table if not exists plots (
  id uuid primary key default gen_random_uuid(),
  address text,
  lat double precision,
  lng double precision,
  length_ft numeric,
  width_ft numeric,
  north_direction text, -- N, NE, E, SE, S, SW, W, NW
  floors int,
  budget_inr numeric,
  bedrooms int,
  bathrooms int,
  kitchen_type text,
  parking boolean,
  garden boolean,
  balcony boolean,
  style text, -- modern | minimal | traditional | luxury
  vastu_preference boolean,
  created_at timestamptz default now()
);

-- Table for Floor Plans
create table if not exists floor_plans (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid references plots(id) on delete cascade,
  floor_number int,
  rooms jsonb, -- [{name, x, y, width, height, doors:[...], windows:[...]}]
  reasoning_notes text, -- Gemini's explanation of layout choices
  created_at timestamptz default now()
);

-- Table for Cost Estimates
create table if not exists cost_estimates (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid references plots(id) on delete cascade,
  category text, -- structure | finishing | interior | labor
  line_item text,
  quantity numeric,
  unit text,
  unit_cost_inr numeric,
  total_cost_inr numeric
);

-- Table for Advisor Messages
create table if not exists advisor_messages (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid references plots(id) on delete cascade,
  role text, -- user | assistant
  content text,
  created_at timestamptz default now()
);
