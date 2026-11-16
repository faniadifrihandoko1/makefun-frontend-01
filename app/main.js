// A make.fun frontend: the board of live bounties, a page for each bounty,
// its leaderboard, and an account's public profile — on hash routes.
//
//   #/                              the board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard
//   #/u/<handle>                    an account's public profile
//
// window.__shotReady is false while a page loads and true once its data is
// on screen, so a screenshot script knows when to capture. A failed fetch
// still renders an error page and sets it true, so the app never hangs.

import { getBounties, getBounty, getLeaderboard, getProfile, lastUpdated } from './api.js';
import { board, boardList, bounty, leaderboard, profile } from './views.js';

const app = document.getElementById('app');
const liveNote = document.getElementById('live-note');

/** Board state lives in memory: search and sort re-render the list only, no refetch. */
const boardState = { query: '', sort: 'deadline', openOnly: false };
let boardData = null;

let ticker = null;

/** Refresh every countdown on screen without rebuilding the page. */
function startTicker() {
  clearInterval(ticker);
  ticker = setInterval(() => {
    document.querySelectorAll('[data-deadline]').forEach((el) => {
      const ms = new Date(el.dataset.deadline).getTime() - Date.now();
      if (ms <= 0) {
        el.textContent = 'ended';
        return;
      }
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      el.textContent = days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
    });
  }, 30_000);
}

function stampLive() {
  if (liveNote) {
    const at = lastUpdated();
    liveNote.textContent = at
      ? `Live data from make.fun's public API · updated ${new Date(at).toLocaleTimeString('en-GB')} · refreshes every minute`
      : 'Live data from make.fun\'s public API';
  }
}

function showError(err) {
  const missing = err && err.status === 404;
  app.innerHTML = `
    <h1>${missing ? 'Not found' : 'Something went wrong'}</h1>
    <p class="empty">${missing ? 'That bounty or account does not exist on make.fun.' : 'make.fun did not answer. Check your connection and try again.'}</p>
    <p><button class="button" onclick="location.reload()">Retry</button> <a href="#/">Back to the board</a></p>`;
  document.title = 'make.fun bounties';
}

function wireBoard() {
  const q = document.getElementById('q');
  const sort = document.getElementById('sort');
  const openOnly = document.getElementById('openOnly');
  const list = document.getElementById('board-list');
  if (!q || !sort || !openOnly || !list) return;
  const rerender = () => {
    boardState.query = q.value;
    boardState.sort = sort.value;
    boardState.openOnly = openOnly.checked;
    list.innerHTML = boardList(boardData, boardState);
    startTicker();
  };
  q.addEventListener('input', rerender);
  sort.addEventListener('change', rerender);
  openOnly.addEventListener('change', rerender);
}

function wireLeaderboard(lb, slug, view) {
  let page = 1;
  document.querySelectorAll('.pager [data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      page = Number(btn.dataset.page);
      app.innerHTML = leaderboard(lb, slug, page, view);
      wireLeaderboard(lb, slug, view);
      window.scrollTo(0, 0);
    });
  });
  document.querySelectorAll('.tabs [data-view]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      window.__shotReady = false;
      const next = await getLeaderboard(slug, btn.dataset.view);
      app.innerHTML = leaderboard(next, slug, 1, btn.dataset.view);
      wireLeaderboard(next, slug, btn.dataset.view);
      window.__shotReady = true;
    });
  });
}

async function render() {
  window.__shotReady = false;
  app.innerHTML = '<p class="loading">Loading…</p>';
  const hash = location.hash || '#/';
  const bountyMatch = hash.match(/^#\/bounty\/([^/?]+)(?:\/leaderboard)?/);
  const profileMatch = hash.match(/^#\/u\/([^/?]+)/);
  try {
    if (bountyMatch && hash.includes('/leaderboard')) {
      const slug = decodeURIComponent(bountyMatch[1]);
      const lb = await getLeaderboard(slug);
      const view = lb.view ?? lb.views?.[0];
      document.title = `${lb.competition.title} · leaderboard | make.fun bounties`;
      app.innerHTML = leaderboard(lb, slug, 1, view);
      wireLeaderboard(lb, slug, view);
    } else if (bountyMatch) {
      const slug = decodeURIComponent(bountyMatch[1]);
      const b = await getBounty(slug);
      document.title = `${b.title} | make.fun bounties`;
      app.innerHTML = bounty(b);
    } else if (profileMatch) {
      const handle = decodeURIComponent(profileMatch[1]);
      const p = await getProfile(handle);
      document.title = `@${p.handle} | make.fun bounties`;
      app.innerHTML = profile(p);
    } else {
      boardData = await getBounties();
      document.title = 'make.fun bounties';
      app.innerHTML = board(boardData, boardState);
      wireBoard();
    }
  } catch (err) {
    showError(err);
  }
  stampLive();
  startTicker();
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

document.getElementById('refresh').addEventListener('click', () => {
  location.reload();
});

/** An avatar that fails to load (a removed account image, a blocked host) becomes the '?' placeholder instead of a broken icon. */
app.addEventListener(
  'error',
  (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement && target.classList.contains('avatar')) {
      const placeholder = document.createElement('span');
      placeholder.className = 'avatar none';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = '?';
      target.replaceWith(placeholder);
    }
  },
  true,
);

window.addEventListener('hashchange', render);
render();
