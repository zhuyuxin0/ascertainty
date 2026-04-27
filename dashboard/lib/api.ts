/**
 * Typed fetch wrappers for the Ascertainty backend API.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Bounty = {
  id: number;
  spec_hash: string;
  poster: string;
  amount_usdc: string;
  deadline_unix: number;
  challenge_window_seconds: number;
  status: string;
  onchain_bounty_id: number | null;
  tx_hash: string | null;
  created_at: number;
};

export type Submission = {
  id: number;
  bounty_id: number;
  solver_address: string;
  attestation_hash: string;
  proof_hash: string;
  accepted: number;
  submitted_at: number;
  onchain_tx_hash: string | null;
};

export type Solver = {
  address: string;
  inft_token_id: number | null;
  reputation: number;
  solved_count: number;
  first_seen_ts: number;
  last_active_ts: number;
};

export type RaceEvent = {
  id: number;
  bounty_id: number;
  solver_address: string;
  event_type: "progress" | "backtrack" | "pit" | "crash" | "finish";
  data_json: string | null;
  ts: number;
};

export type Stats = { bounties: number };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  stats: () => get<Stats>("/stats"),
  bounties: (limit = 50) =>
    get<{ bounties: Bounty[] }>(`/bounties?limit=${limit}`),
  bountyStatus: (id: number) =>
    get<{ bounty: Bounty; submissions: Submission[] }>(`/bounty/${id}/status`),
  raceEvents: (id: number, since = 0) =>
    get<{ events: RaceEvent[]; now: number }>(
      `/bounty/${id}/race-events?since=${since}`,
    ),
  leaderboard: (limit = 20) =>
    get<{ solvers: Solver[] }>(`/leaderboard?limit=${limit}`),
};
