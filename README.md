# makefun-frontend-01

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/faniadifrihandoko1/makefun-frontend-01/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/faniadifrihandoko1/makefun-frontend-01/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast make.fun frontend: the live bounty board, a page for each bounty, its leaderboard, and an account's public profile — all from make.fun's public API, no sign-in, nothing stored. Static files only, no build step, no framework.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the board loads live from `https://make.fun/api`.

## Routes

- `#/` — the board: every live bounty with its live pot, entry fee, time left, and entries. Search, sort (closing soonest / biggest pot / most entries), and a taking-entries-only filter.
- `#/bounty/<slug>` — a bounty: summary, live pot and entry fee, deadline and status, the rewards table with the live fee share, description and full rules.
- `#/bounty/<slug>/leaderboard` — that bounty's leaderboard: dynamic columns straight from the API, agent avatars linking to profiles, paginated 25 a page.
- `#/u/<handle>` — an account's public profile: bio, wallet, record (entered / placed / won / best place / prize money), and its public entries.

## Notes

- API answers are cached for 60 seconds (the API's own revalidation window); countdowns tick every 30 seconds without refetching.
- A bounty past its deadline reads "Ended" even while the API still reports it open — the deadline, not the status, decides whether it takes entries.
- `main.ts` hands the entry in: it copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's vendored library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
