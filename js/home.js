import { stratagems, dataAsOf } from './data.js';

const $ = (selector) => document.querySelector(selector);
const viewport = $('#chart-viewport');
const chart = $('#chart');
const hotspots = $('#chart-hotspots');
const search = $('#atlas-search');
const suggestions = $('#search-results');
const dialog = $('#stratagem-dialog');
const detail = $('#dialog-content');
const arrows = { up: '▲', down: '▼', left: '◀', right: '▶' };
const buttons = new Map();
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const formatDuration = (seconds) => seconds == null ? 'Unverified' : Number(seconds) === 0 ? 'N/A' : Number(seconds) >= 60 ? `${Math.floor(Number(seconds) / 60)}:${String(Number(seconds) % 60).padStart(2, '0')}` : `${Number(seconds)}s`;
let chartWidth = 0;
let userZoomed = false;

function fitWidth() {
  return Math.min(viewport.clientWidth, viewport.clientHeight * 36 / 16);
}

function setChartWidth(nextWidth, preserveCenter = true) {
  const priorWidth = chartWidth || chart.getBoundingClientRect().width || nextWidth;
  const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / priorWidth;
  const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / (priorWidth * 16 / 36);
  chartWidth = Math.max(320, Math.min(3600, Math.round(nextWidth)));
  chart.style.width = `${chartWidth}px`;
  if (preserveCenter) requestAnimationFrame(() => {
    viewport.scrollLeft = Math.max(0, centerX * chartWidth - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, centerY * chartWidth * 16 / 36 - viewport.clientHeight / 2);
  });
}

function initializeZoom() {
  setChartWidth(window.matchMedia('(max-width: 900px)').matches ? 2200 : fitWidth(), false);
}

function stat(label, value) {
  return `<div class="stat"><span>${label}</span><strong>${escapeHtml(value ?? 'Unverified')}</strong></div>`;
}

function openDetail(entry) {
  const code = entry.code.length ? entry.code.map((direction) => `<span class="direction" aria-label="${direction}">${arrows[direction]}</span>`).join('') : '<span class="direction empty">INPUT CODE UNVERIFIED</span>';
  const stats = [
    stat('Base cooldown', formatDuration(entry.cooldownSeconds)),
    stat('Call-in time', entry.callInSeconds == null ? 'Unverified' : `${entry.callInSeconds}s`),
    stat('Uses / rearm', entry.usesPerRearm ?? entry.uses ?? 'Unverified'),
  ];
  if (entry.rearmSeconds != null) stats.push(stat('Eagle rearm', formatDuration(entry.rearmSeconds)));
  if (entry.blastRadiusMeters != null) stats.push(stat('Blast radius', `${entry.blastRadiusMeters}m`));
  if (entry.demolitionStrength != null) stats.push(stat('Demolition', entry.demolitionStrength));
  if (entry.damage != null) stats.push(stat('Damage', entry.damage));
  if (entry.capacity != null) stats.push(stat('Capacity', entry.capacity));
  if (entry.fireRate != null) stats.push(stat('Fire rate', entry.fireRate));
  if (entry.armorPenetration != null) stats.push(stat('Armor penetration', entry.armorPenetration));
  if (entry.dps != null) stats.push(stat('Listed DPS', entry.dps));
  if (entry.cost != null) stats.push(stat('Unlock cost', entry.cost));
  if (entry.unlockedFrom != null) stats.push(stat('Unlock', entry.unlockedFrom));
  detail.innerHTML = `<div class="detail" style="--accent:${entry.accent}">
    <div class="detail-top"><img class="detail-icon" src="${escapeHtml(entry.icon)}" alt=""><div><div class="detail-eyebrow">ELEMENT ${String(entry.number).padStart(3, '0')} / ${escapeHtml(entry.category.toUpperCase())}</div><h2 id="detail-name">${escapeHtml(entry.name)}</h2><div class="detail-family">${escapeHtml(entry.availability || 'STRATAGEM FIELD RECORD')}</div></div></div>
    <p class="detail-label">CALL-IN SEQUENCE</p><div class="detail-sequence" aria-label="${escapeHtml(entry.code.join(', ') || 'Unverified')}">${code}</div>
    <p class="detail-label">DEPLOYMENT INTEL</p><div class="stat-grid">${stats.join('')}</div>
    ${entry.description ? `<p class="detail-description">${escapeHtml(entry.description)}</p>` : ''}
    <div class="detail-source"><span>BASE FIGURES · CHECK GAME MODIFIERS<br>DATA REVIEWED ${dataAsOf.toUpperCase()}${entry.sourceNote ? `<br>${escapeHtml(entry.sourceNote)}` : ''}</span>${entry.sourceUrl ? `<a href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">VIEW SOURCE ↗</a>` : ''}</div>
  </div>`;
  dialog.showModal();
}

function renderHotspots(layout) {
  for (const entry of [...stratagems].sort((a, b) => a.number - b.number)) {
    const box = layout[entry.id];
    if (!box) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'element-hotspot';
    button.style.cssText = `--accent:${entry.accent};left:${box.x / 36}%;top:${box.y / 16}%;width:${box.w / 36}%;height:${box.h / 16}%`;
    button.setAttribute('aria-label', `Element ${String(entry.number).padStart(3, '0')}: ${entry.name}. Open stats.`);
    button.title = entry.name;
    button.dataset.id = entry.id;
    button.addEventListener('click', () => openDetail(entry));
    hotspots.append(button);
    buttons.set(entry.id, button);
  }
}

function jumpTo(entry, showDetail = true) {
  const button = buttons.get(entry.id);
  if (!button) return;
  const buttonBox = button.getBoundingClientRect();
  const viewportBox = viewport.getBoundingClientRect();
  viewport.scrollTo({
    left: viewport.scrollLeft + buttonBox.left - viewportBox.left + buttonBox.width / 2 - viewport.clientWidth / 2,
    top: viewport.scrollTop + buttonBox.top - viewportBox.top + buttonBox.height / 2 - viewport.clientHeight / 2,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  if (showDetail) openDetail(entry);
}

function updateSearch() {
  const query = search.value.trim().toLocaleLowerCase();
  const matches = query ? stratagems.filter((entry) => `${entry.name} ${entry.category} ${entry.number}`.toLocaleLowerCase().includes(query)) : [];
  for (const [id, button] of buttons) {
    button.dataset.dimmed = query && !matches.some((entry) => entry.id === id) ? 'true' : 'false';
    button.dataset.matched = query && matches.some((entry) => entry.id === id) ? 'true' : 'false';
  }
  suggestions.replaceChildren();
  if (query) {
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = 'NO MATCHING STRATAGEMS';
      suggestions.append(empty);
    }
    for (const entry of matches.slice(0, 8)) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'search-result';
      const name = document.createElement('span');
      const family = document.createElement('small');
      name.textContent = `${String(entry.number).padStart(3, '0')}  ${entry.name}`;
      family.textContent = entry.category;
      choice.append(name, family);
      choice.addEventListener('click', () => {
        search.value = entry.name;
        suggestions.hidden = true;
        search.setAttribute('aria-expanded', 'false');
        updateHighlights(entry.id);
        jumpTo(entry);
      });
      suggestions.append(choice);
    }
  }
  suggestions.hidden = !query;
  search.setAttribute('aria-expanded', String(Boolean(query)));
  return matches;
}

function updateHighlights(id) {
  for (const [key, button] of buttons) {
    button.dataset.dimmed = key === id ? 'false' : 'true';
    button.dataset.matched = key === id ? 'true' : 'false';
  }
}

search.addEventListener('input', updateSearch);
search.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const first = updateSearch()[0];
    if (first) {
      event.preventDefault();
      suggestions.hidden = true;
      search.setAttribute('aria-expanded', 'false');
      updateHighlights(first.id);
      jumpTo(first);
    }
  }
  if (event.key === 'Escape') {
    suggestions.hidden = true;
    search.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-wrap')) {
    suggestions.hidden = true;
    search.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !dialog.open && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
});
$('#dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
$('#zoom-fit').addEventListener('click', () => { userZoomed = true; setChartWidth(fitWidth(), false); viewport.scrollTo({ left: 0, top: 0 }); });
$('#zoom-readable').addEventListener('click', () => { userZoomed = true; setChartWidth(2200); });
$('#zoom-in').addEventListener('click', () => { userZoomed = true; setChartWidth(chartWidth * 1.35); });
$('#zoom-out').addEventListener('click', () => { userZoomed = true; setChartWidth(Math.max(fitWidth(), chartWidth / 1.35)); });
window.addEventListener('resize', () => { if (!userZoomed) initializeZoom(); });

initializeZoom();
const response = await fetch(new URL('../data/tile-layout.json', import.meta.url));
if (response.ok) renderHotspots(await response.json());
else console.error('The interactive tile layout could not be loaded.');