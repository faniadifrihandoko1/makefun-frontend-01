// The four surfaces, each a function from live API data to HTML.
// The router in main.js fetches the data and drops the returned HTML into
// #app; lists re-render in place when the board's search or sort changes.

import { ago, bytes, date, esc, md, money, num, rate, shortAddr, takesEntries, timeLeft } from './format.js';

/** The live pot: the prize plus every entry fee paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee chip, or a free-entry chip when the bounty charges none. */
const feeChip = (b) =>
  b.entryFeeUsd
    ? `<span class="chip fee">${money(b.entryFeeUsd)} entry fee</span>`
    : '<span class="chip free">Free entry</span>';

/** 'Taking entries' while the deadline is ahead, 'Ended' once it has passed. */
const statusChip = (b) =>
  takesEntries(b)
    ? '<span class="chip open">Taking entries</span>'
    : '<span class="chip ended">Ended</span>';

/** An avatar image: API paths are relative to make.fun, some entries carry a full URL instead. */
const avatarSrc = (path) => (path.startsWith('http://') || path.startsWith('https://') ? path : `https://make.fun${path}`);

const avatar = (path, alt) =>
  path
    ? `<img class="avatar" crossorigin="anonymous" src="${esc(avatarSrc(path))}" alt="${esc(alt)}" loading="lazy">`
    : '<span class="avatar none" aria-hidden="true">?</span>';

/* ------------------------------------------------------------------ board */

function boardCard(b) {
  return `
  <li class="card">
    <a class="card-title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
    <p class="card-meta">${esc(b.category ?? '')} ${statusChip(b)}</p>
    <p class="card-pot"><span class="pot">${pot(b)}</span><span class="pot-base">of ${money(b.rewardAmount)} prize</span></p>
    <p class="card-row">${feeChip(b)}
      <span class="time" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span></p>
    <p class="card-row"><span>${num(b.submissionCount)} entries</span>
      <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a></p>
  </li>`;
}

/** The board controls: search, sort, and a taking-entries filter. */
export function boardControls(state) {
  return `
  <div class="controls" role="search">
    <input id="q" type="search" placeholder="Search bounties…" value="${esc(state.query)}" aria-label="Search bounties">
    <select id="sort" aria-label="Sort bounties">
      <option value="deadline" ${state.sort === 'deadline' ? 'selected' : ''}>Closing soonest</option>
      <option value="pot" ${state.sort === 'pot' ? 'selected' : ''}>Biggest pot</option>
      <option value="entries" ${state.sort === 'entries' ? 'selected' : ''}>Most entries</option>
    </select>
    <label class="filter"><input id="openOnly" type="checkbox" ${state.openOnly ? 'checked' : ''}> Taking entries only</label>
  </div>`;
}

function filterBoard(items, state) {
  const q = state.query.trim().toLowerCase();
  let rows = items.filter((b) => (!q || b.title.toLowerCase().includes(q)) && (!state.openOnly || takesEntries(b)));
  if (state.sort === 'pot') rows = [...rows].sort((a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount));
  else if (state.sort === 'entries') rows = [...rows].sort((a, b) => b.submissionCount - a.submissionCount);
  else
    // Closing soonest — but bounties still taking entries first, so the board opens on live ones, not ended ones.
    rows = [...rows].sort(
      (a, b) => Number(takesEntries(b)) - Number(takesEntries(a)) || new Date(a.deadline) - new Date(b.deadline),
    );
  return rows;
}

/** The board list only (re-rendered when search/sort changes, without refetching). */
export function boardList(data, state) {
  const rows = filterBoard(data.items, state);
  if (rows.length === 0) return '<p class="empty">No bounties match. Clear the search or the filter.</p>';
  return `<ul class="grid">${rows.map(boardCard).join('')}</ul>`;
}

export function board(data, state) {
  const open = data.items.filter(takesEntries);
  const totalPot = data.items.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const totalEntries = data.items.reduce((sum, b) => sum + (b.submissionCount || 0), 0);
  return `
  <p class="kicker">Live · ${open.length} taking entries</p>
  <h1>Open bounties</h1>
  <p class="lede">Live bounties on make.fun — agents and programs competing for cash, ranked in the open.</p>
  <p class="stats"><strong>${open.length}</strong> taking entries · <strong class="stat-pot">${money(totalPot)}</strong> in live pots · <strong>${num(totalEntries)}</strong> entries</p>
  ${boardControls(state)}
  <div id="board-list">${boardList(data, state)}</div>`;
}

/* ----------------------------------------------------------------- bounty */

/** The rewards table: consecutive places paying the same amount share one row ('4–10'). */
function rewardsTable(b) {
  const rows = b.rewardsNow ?? [];
  if (rows.length > 0) {
    const grouped = [];
    for (const r of rows) {
      const last = grouped[grouped.length - 1];
      if (last && last.amountUsd === r.amountUsd && last.to === r.place - 1) last.to = r.place;
      else grouped.push({ from: r.place, to: r.place, baseUsd: r.baseUsd, feeShareUsd: r.feeShareUsd, amountUsd: r.amountUsd });
    }
    return `
    <table class="rewards">
      <thead><tr><th>Place</th><th>Prize</th><th>Fee share</th><th>Total now</th></tr></thead>
      <tbody>${grouped
        .map(
          (g) => `<tr><td>${g.from === g.to ? `#${g.from}` : `#${g.from}–${g.to}`}</td><td>${money(g.baseUsd)}</td><td>${money(g.feeShareUsd)}</td><td><strong>${money(g.amountUsd)}</strong></td></tr>`,
        )
        .join('')}</tbody>
    </table>
    <p class="note">Totals grow as entry fees are paid in — ${num(b.entryFeePayers ?? 0)} ${b.entryFeePayers === 1 ? 'account has' : 'accounts have'} paid the fee so far.</p>`;
  }
  const map = b.rewards ?? {};
  const places = Object.keys(map)
    .map(Number)
    .sort((a, z) => a - z);
  if (places.length === 0) return '<p class="empty">No rewards table published yet.</p>';
  return `
  <table class="rewards">
    <thead><tr><th>Place</th><th>Prize</th></tr></thead>
    <tbody>${places.map((p) => `<tr><td>#${p}</td><td><strong>${money(map[p])}</strong></td></tr>`).join('')}</tbody>
  </table>`;
}

export function bounty(b) {
  const phases = (b.phases ?? [])
    .map((p) => `<li><strong>${esc(p.title)}</strong> — ${esc(p.description ?? '').slice(0, 160)}</li>`)
    .join('');
  return `
  <p class="crumbs"><a href="#/">All bounties</a> · <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a></p>
  <p class="kicker">${esc(b.category ?? 'Bounty')}</p>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${esc(b.summary ?? '')}</p>
  <dl class="facts">
    <dt>Live pot</dt><dd><strong class="pot">${pot(b)}</strong> <span class="muted">(prize ${money(b.rewardAmount)})</span></dd>
    <dt>Entry fee</dt><dd>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'None — free to enter'}</dd>
    <dt>Deadline</dt><dd>${date(b.deadline)} · <span class="time" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span></dd>
    <dt>Opens</dt><dd>${b.opensAt ? date(b.opensAt) : '—'}</dd>
    <dt>Status</dt><dd>${esc(b.status)} ${takesEntries(b) ? '· taking entries' : '· entries closed'}</dd>
    <dt>Entries</dt><dd>${num(b.submissionCount)}</dd>
  </dl>
  <h2>Rewards</h2>
  ${rewardsTable(b)}
  <h2>Description</h2>
  <div class="prose">${md(b.description ?? '')}</div>
  ${b.rules ? `<details class="rules"><summary>Full rules</summary><div class="prose">${md(b.rules)}</div></details>` : ''}
  ${phases ? `<h2>Phases</h2><ul>${phases}</ul>` : ''}
  <p><a class="button" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">See the leaderboard →</a></p>`;
}

/* ------------------------------------------------------------- leaderboard */

function metricCell(column, entry) {
  const raw = entry.values?.[column.key];
  const shown = entry.display?.[column.key];
  if (raw === null || raw === undefined) return '—';
  if (column.key === 'bytes') return bytes(raw);
  if (column.source && column.source.includes('win_rate_micro')) return rate(raw);
  if (column.source && column.source.includes('interval')) return rate(raw);
  if (column.key === 'valid') return raw ? '✓' : '—';
  const n = Number(shown ?? raw);
  return Number.isFinite(n) ? num(n) : esc(shown ?? String(raw));
}

/** One page of the leaderboard table. */
function leaderboardRows(lb, page) {
  const perPage = 25;
  const start = (page - 1) * perPage;
  return lb.entries.slice(start, start + perPage).map((e) => {
    const medal = e.prize_rank === 1 ? '🥇' : e.prize_rank === 2 ? '🥈' : e.prize_rank === 3 ? '🥉' : '';
    return `
    <tr>
      <td class="rank">#${e.rank}</td>
      <td><a class="agent" href="#/u/${encodeURIComponent(e.handle)}">${avatar(e.image, e.handle)}<span>${esc(e.handle)}</span></a>${medal}</td>
      <td class="entry-title">${esc(e.title ?? '')}</td>
      ${lb.columns.map((c) => `<td class="metric">${metricCell(c, e)}</td>`).join('')}
    </tr>`;
  }).join('');
}

export function leaderboard(lb, slug, page, view) {
  const perPage = 25;
  const pages = Math.max(1, Math.ceil(lb.entries.length / perPage));
  const current = Math.min(Math.max(1, page), pages);
  const tabs =
    lb.views && lb.views.length > 1
      ? `<div class="tabs" role="tablist">${lb.views
          .map((v) => `<button data-view="${esc(v)}" class="${view === v ? 'active' : ''}" role="tab" aria-selected="${view === v}">${esc(v)}</button>`)
          .join('')}</div>`
      : '';
  return `
  <p class="crumbs"><a href="#/">All bounties</a> · <a href="#/bounty/${encodeURIComponent(slug)}">${esc(lb.competition.title)}</a></p>
  <p class="kicker">Leaderboard</p>
  <h1>${esc(lb.competition.title)}</h1>
  <p class="lede">Leaderboard · ${esc(lb.phase?.title ?? '')} · ${esc(lb.title ?? 'Results')} · ${num(lb.entries.length)} entries</p>
  ${tabs}
  ${
    lb.entries.length === 0
      ? '<p class="empty">No entries yet — be the first.</p>'
      : `
  <div class="table-wrap"><table class="board-table">
    <thead><tr><th>Rank</th><th>Agent</th><th>Entry</th>${lb.columns.map((c) => `<th>${esc(c.title)}</th>`).join('')}</tr></thead>
    <tbody>${leaderboardRows(lb, current)}</tbody>
  </table></div>
  ${
    pages > 1
      ? `<nav class="pager" aria-label="Leaderboard pages">
          <button data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>← Prev</button>
          <span>Page ${current} of ${pages}</span>
          <button data-page="${current + 1}" ${current === pages ? 'disabled' : ''}>Next →</button>
        </nav>`
      : ''
  }`
  }
  <p class="note">Ranked by ${esc(lb.rank_key ?? 'score')}${lb.tie_break ? ` · ties broken by ${esc(lb.tie_break.title)} (${esc(lb.tie_break.better)})` : ''}.</p>`;
}

/* ----------------------------------------------------------------- profile */

export function profile(p) {
  const r = p.record ?? {};
  const solutions = p.solutions ?? [];
  return `
  <p class="crumbs"><a href="#/">All bounties</a></p>
  <p class="kicker">Public profile</p>
  <div class="profile-head">
    ${avatar(p.avatar?.url ?? p.image, p.handle)}
    <div>
      <h1>@${esc(p.handle)}</h1>
      ${p.display_name ? `<p class="lede">${esc(p.display_name)}</p>` : ''}
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
      <p class="muted">Joined ${p.joined_at ? date(p.joined_at) : '—'}${p.github_login ? ` · GitHub @${esc(p.github_login)}` : ''}</p>
    </div>
  </div>
  <dl class="stats-grid">
    <div><dt>Entered</dt><dd>${num(r.competitions_entered)}</dd></div>
    <div><dt>Placed</dt><dd>${num(r.competitions_placed)}</dd></div>
    <div><dt>Won</dt><dd>${num(r.competitions_won)}</dd></div>
    <div><dt>Podiums</dt><dd>${num(r.podium_finishes)}</dd></div>
    <div><dt>Best place</dt><dd>${r.best_placement ? `#${num(r.best_placement)}` : '—'}</dd></div>
    <div><dt>Prize money</dt><dd>${money(r.prize_usd)}</dd></div>
  </dl>
  ${
    p.wallet?.address
      ? `<p class="wallet">Wallet <a href="${esc(p.wallet.explorer_url ?? '#')}" target="_blank" rel="noopener">${shortAddr(p.wallet.address)}</a></p>`
      : ''
  }
  <h2>Entries</h2>
  ${
    solutions.length === 0
      ? '<p class="empty">No public entries yet.</p>'
      : `
  <div class="table-wrap"><table class="board-table">
    <thead><tr><th>Entry</th><th>Bounty</th><th>Score</th><th>Placed</th><th>Prize</th><th>Entered</th></tr></thead>
    <tbody>${solutions
      .map(
        (s) => `<tr>
        <td class="entry-title">${esc(s.title ?? '')}</td>
        <td><a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a></td>
        <td>${s.score ? (s.score.column?.source?.includes('win_rate_micro') ? rate(s.score.value) : num(s.score.display ?? s.score.value)) : '—'}</td>
        <td>${s.placement ? `#${num(s.placement)}` : '—'}</td>
        <td>${s.prize_usd ? money(s.prize_usd) : '—'}</td>
        <td>${s.entered_at ? ago(s.entered_at) : '—'}</td>
      </tr>`,
      )
      .join('')}</tbody>
  </table></div>`
  }`;
}
