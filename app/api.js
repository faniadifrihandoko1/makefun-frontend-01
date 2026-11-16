// make.fun's public API, read-only GET, open to any origin (CORS).
// Docs: https://make.fun/api/openapi.json — every call below is a plain GET.
//
// The API's answers are revalidated by the minute (its ETags are bound to
// the minute), so a 60-second in-memory cache keeps each view to the fewest
// requests the page needs: the board is one request, a bounty page one,
// a leaderboard one, a profile one. Stale answers are never shown as live:
// every view stamps when its data was fetched.

const API = 'https://make.fun/api';
const TTL_MS = 60_000;

const cache = new Map(); // path -> { at, data }
let lastFetchAt = 0;

/** When the freshest data on screen was fetched (epoch ms). */
export function lastUpdated() {
  return lastFetchAt;
}

async function get(path) {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && now - hit.at < TTL_MS) return hit.data;
  const res = await fetch(API + path);
  if (!res.ok) {
    const err = new Error(`make.fun API ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  cache.set(path, { at: now, data });
  lastFetchAt = now;
  return data;
}

/** The live bounties, newest activity first. Items carry rewardAmount, potUsd, entryFeeUsd, deadline and submissionCount. */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, by slug: summary, description, rules, rewardsNow, dates, status. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: dynamic columns, phase, and ranked entries. `view` is 'overall' or 'performance' when the bounty offers both. */
export const getLeaderboard = (slug, view) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard${view ? `?view=${encodeURIComponent(view)}` : ''}`);

/** An account's public profile: bio, wallet, record, and public entries. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
