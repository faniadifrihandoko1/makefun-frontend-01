// Small helpers for showing API values, and a tiny safe Markdown renderer
// for the bounty description and rules the API returns as Markdown text.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('638.50', 100 or 0.5) as '$638.50' or '$100'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A whole number with thousands separators ('10539' -> '10,539'). */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A byte count as '661 KB' or '1.2 MB'. */
export function bytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** A deadline as a date in UTC. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** True while a bounty still takes entries: the API may still read 'open' past the deadline, so the deadline decides. */
export function takesEntries(bounty) {
  return new Date(bounty.deadline).getTime() > Date.now();
}

/** '3d ago' for a timestamp. */
export function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || Number.isNaN(ms)) return '';
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return `${Math.max(1, Math.floor(ms / 60000))}m ago`;
}

/** A leaderboard rate stored in micro units (950587) as '95.06%'. */
export function rate(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(2)}%`;
}

/** A Solana address shortened to 'BueP…LC45'. */
export function shortAddr(addr) {
  const s = String(addr ?? '');
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

/**
 * Render Markdown to HTML, safely: the text is escaped first, then only
 * headings, bold, italic, inline code, links, bullet and numbered lists
 * and paragraphs are recognised. Links to any https URL are kept as links.
 */
export function md(text) {
  const lines = String(text ?? '').split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol' | null
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, (_, bold) => `<strong>${bold}</strong>`)
      .replace(/(^|[^*])\*([^*\n]+)\*/g, (_, before, it) => `${before}<em>${it}</em>`)
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, label, href) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`);
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(4, heading[1].length + 1);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet) {
      if (list !== 'ul') {
        closeList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (numbered) {
      if (list !== 'ol') {
        closeList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}
