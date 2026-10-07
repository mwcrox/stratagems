import { supabaseUrl, supabasePublishableKey } from './config.js';

const STORAGE_KEY = 'managed-democracy-stratagem-hero-top-five-v1';
const TABLE = 'stratagem_hero_scores';
const FETCH_TIMEOUT_MS = 8000;

const configured = Boolean(
  typeof supabaseUrl === 'string' && /^https:\/\//.test(supabaseUrl) &&
  typeof supabasePublishableKey === 'string' && supabasePublishableKey.trim()
);

export const leaderboard = {
  mode: configured ? 'checking' : 'local',
  scores: [],
  status: configured ? 'Checking shared leaderboard…' : 'Saved on this device only. Configure Supabase to share scores across players.',

  async refresh() {
    if (!configured) {
      this.mode = 'local';
      this.scores = readLocal();
      this.status = 'Saved on this device only. Scores on other devices are separate.';
      return this.scores;
    }
    try {
      const params = '?select=name,score,round_reached,created_at&order=score.desc,created_at.asc&limit=5';
      const response = await request(`${baseUrl()}/rest/v1/${TABLE}${params}`);
      this.scores = normalizeScores(response);
      this.mode = 'shared';
      this.status = 'Shared top five. Scores are available to everyone visiting this site.';
    } catch (error) {
      this.mode = 'local';
      this.scores = readLocal();
      this.status = 'Shared leaderboard unavailable. Scores are saved on this device only until the connection returns.';
    }
    return this.scores;
  },

  qualifies(score) {
    if (!Number.isSafeInteger(score) || score <= 0) return false;
    return this.scores.length < 5 || score > this.scores[4].score;
  },

  async publish(name, score, roundReached) {
    const cleanName = String(name ?? '').trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2 || cleanName.length > 20 || /[\u0000-\u001f\u007f]/.test(cleanName)) {
      throw new Error('Enter a name between 2 and 20 characters.');
    }
    if (!Number.isSafeInteger(score) || score <= 0 || !Number.isSafeInteger(roundReached) || roundReached < 1) {
      throw new Error('This score cannot be published.');
    }

    if (this.mode === 'shared') {
      try {
        const result = await request(`${baseUrl()}/rest/v1/rpc/submit_stratagem_hero_score`, {
          method: 'POST',
          body: JSON.stringify({ player_name: cleanName, points: score, round_reached: roundReached })
        });
        this.scores = normalizeScores(result?.leaderboard);
        if (result?.accepted) return { accepted: true, scope: 'shared' };
        return { accepted: false, scope: 'shared', reason: result?.reason || 'The top five changed before your score was published.' };
      } catch (error) {
        // A failed request does not prove the score was rejected. Do not silently
        // publish it to another leaderboard or duplicate a potentially saved run.
        throw new Error('The shared leaderboard could not be reached. Please try publishing again.');
      }
    }

    const local = readLocal();
    const prior = local.find(entry => entry.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
    if (prior && prior.score >= score) {
      this.scores = local;
      return { accepted: false, scope: 'local', reason: 'This name already has an equal or higher score on this device.' };
    }
    const remaining = local.filter(entry => entry.name.toLocaleLowerCase() !== cleanName.toLocaleLowerCase());
    if (remaining.length >= 5 && score <= remaining[4].score) {
      this.scores = local;
      return { accepted: false, scope: 'local', reason: 'The top five changed before your score was published.' };
    }
    const next = normalizeScores([...remaining, { name: cleanName, score, round_reached: roundReached, created_at: new Date().toISOString() }]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      throw new Error('This browser could not save the score. Check that local storage is available.');
    }
    this.scores = next;
    return { accepted: true, scope: 'local' };
  }
};

function baseUrl() {
  return supabaseUrl.replace(/\/+$/, '');
}

function normalizeScores(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(entry => entry && typeof entry.name === 'string' && Number.isFinite(Number(entry.score)))
    .map(entry => ({
      name: entry.name,
      score: Math.trunc(Number(entry.score)),
      round_reached: Math.trunc(Number(entry.round_reached || 1)),
      created_at: entry.created_at || ''
    }))
    .sort((a, b) => b.score - a.score || String(a.created_at).localeCompare(String(b.created_at)))
    .slice(0, 5);
}

function readLocal() {
  try {
    return normalizeScores(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch (error) {
    return [];
  }
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: supabasePublishableKey,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status}).`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}