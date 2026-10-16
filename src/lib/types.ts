import type { Currency } from "./money";
export type Status = "estimated" | "reserved" | "paid";
export const categories = [
  "Alojamiento",
  "Transporte",
  "Comida",
  "Actividades",
  "Compras",
  "Otros",
] as const;
export type Trip = {
  id: string;
  name: string;
  owner_id: string;
  route_stops: string[];
  budget_minor: number;
  usd_per_eur?: string | null;
  display_rate_date?: string | null;
  starts_on: string;
  ends_on: string;
};
export type Member = {
  trip_id: string;
  user_id: string;
  display_name: string;
  email: string;
};
export type Expense = {
  id: string;
  trip_id: string;
  description: string;
  category: string;
  amount_minor: number;
  currency: Currency;
  rate_to_eur: string | number;
  eur_minor: number;
  rate_date: string;
  occurred_on: string;
  status: Status;
  payer_id: string;
  created_by: string;
  notes: string;
  created_at: string;
  split_method?: "equal" | "amount" | "percent";
  paid_original_minor?: number;
  paid_eur_minor?: number;
};
export type Share = {
  expense_id: string;
  member_id: string;
  amount_minor: number;
  weight?: number;
};
export type Settlement = {
  id: string;
  trip_id: string;
  from_id: string;
  to_id: string;
  amount_minor: number;
  currency: Currency;
  rate_to_eur: string | number;
  eur_minor: number;
  occurred_on: string;
  rate_date: string;
  notes: string;
};
export type Event = {
  id: string;
  trip_id: string;
  title: string;
  city: string;
  starts_on: string;
  ends_on: string;
  kind: "stay" | "transport" | "activity";
  location?: string;
  start_time?: string | null;
  end_time?: string | null;
  time_zone?: string;
  notes: string;
  expense_id: string | null;
};
export type Scenario = {
  id: string;
  trip_id: string;
  name: string;
  notes: string;
};
export type ScenarioItem = {
  id: string;
  scenario_id: string;
  description: string;
  amount_minor: number;
  currency: Currency;
  rate_to_eur: string | number;
  eur_minor: number;
  confidence: "estimated" | "quoted" | "confirmed";
  source: string;
  rate_date: string;
};
export type Invitation = {
  id: string;
  trip_id: string;
  email: string;
  created_at: string;
  expires_at: string;
};
export type Receipt = {
  id: string;
  trip_id: string;
  expense_id: string;
  path: string;
  filename: string;
};
export type HQData = {
  trip: Trip;
  members: Member[];
  expenses: Expense[];
  shares: Share[];
  settlements: Settlement[];
  events: Event[];
  scenarios: Scenario[];
  items: ScenarioItem[];
  invitations: Invitation[];
  receipts: Receipt[];
  userId: string;
  personal_budget_minor?: number | null;
  payments?: ExpensePayment[];
  activity?: Activity[];
};

export type ExpensePayment = {
  id: string;
  trip_id: string;
  expense_id: string;
  payer_id: string;
  amount_minor: number;
  eur_minor: number;
  rate_to_eur: string | number;
  rate_date: string;
  occurred_on: string;
  notes: string;
  created_by: string;
};
export type Activity = {
  id: string;
  actor_id: string | null;
  entity: string;
  action: string;
  label: string;
  created_at: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
};
