import { stratagems } from './data.js';
import { leaderboard } from './leaderboard.js';

// The original arcade's exact timer and bonus algorithm has not been published.
// These values follow the observed six-to-sixteen round structure, 25 points
// per solved code, and the familiar round/time/perfect bonus display.
const ROUND_TIME_MS = 10_000;
const TIME_RESTORED_MS = 1_000;
const ROUND_SUMMARY_MS = 1_450;
const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
const KEY_DIRECTIONS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right'
};
const element = id => document.getElementById(id);
const ui = {
  round: element('roundValue'), score: element('scoreValue'), time: element('timeValue'),
  timeTrack: element('timeTrack'), timeFill: element('timeFill'),
  progress: element('roundProgress'), icon: element('stratagemIcon'),
  category: element('stratagemCategory'), name: element('stratagemName'),
  code: element('codeSequence'), feedback: element('inputFeedback'),
  queue: element('queueList'), summary: element('roundSummary'),
  summaryHeading: element('summaryHeading'), summaryRound: element('summaryRound'),
  summaryTime: element('summaryTime'), summaryPerfect: element('summaryPerfect'),
  summaryTotal: element('summaryTotal'), startOverlay: element('startOverlay'),
  gameOver: element('gameOverOverlay'), finalScore: element('finalScore'),
  gameOverMessage: element('gameOverMessage'), publishForm: element('publishForm'),
  publishNote: element('publishNote'), playerName: element('playerName'),
  publishButton: element('publishButton'), leaderboardList: element('leaderboardList'),
  leaderboardEmpty: element('leaderboardEmpty'), leaderboardStatus: element('leaderboardStatus')
};

const pool = (Array.isArray(stratagems) ? stratagems : [])
  .map(item => ({ ...item, sequence: normalizeCode(item.code) }))
  .filter(item => item.name && item.sequence.length >= 3 && !/deprecated|unavailable/i.test(item.availability || ''));

const game = {
  phase: 'ready', round: 1, score: 0, solved: 0, mistakes: 0,
  inputIndex: 0, remainingMs: ROUND_TIME_MS, previousFrame: 0,
  roundItems: [], generation: 0, animationId: 0, summaryTimeout: 0
};

function normalizeCode(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ?
    (/[\s,]/.test(value) ? value.split(/[\s,]+/) : [...value]) : [];
  const aliases = {
    u: 'up', d: 'down', l: 'left', r: 'right',
    '↑': 'up', '↓': 'down', '←': 'left', '→': 'right'
  };
  const sequence = values.map(value => {
    const normalized = String(value).trim().toLowerCase();
    return ARROWS[normalized] ? normalized : aliases[normalized];
  });
  return sequence.every(Boolean) ? sequence : [];
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    let random = Math.random();
    if (globalThis.crypto?.getRandomValues) {
      const number = new Uint32Array(1);
      crypto.getRandomValues(number);
      random = number[0] / 4294967296;
    }
    const other = Math.floor(random * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function setFeedback(message, isError = false) {
  ui.feedback.textContent = message;
  ui.feedback.classList.toggle('is-error', isError);
}

function renderLeaderboard() {
  ui.leaderboardList.replaceChildren();
  leaderboard.scores.forEach((entry, index) => {
    const row = document.createElement('li');
    const rank = document.createElement('span');
    const name = document.createElement('span');
    const score = document.createElement('strong');
    rank.className = 'rank';
    name.className = 'leader-name';
    score.className = 'leader-points';
    rank.textContent = String(index + 1).padStart(2, '0');
    name.textContent = entry.name;
    score.textContent = Number(entry.score).toLocaleString();
    row.append(rank, name, score);
    ui.leaderboardList.append(row);
  });
  ui.leaderboardEmpty.hidden = leaderboard.scores.length > 0;
  if (!leaderboard.scores.length) ui.leaderboardEmpty.textContent = 'No published scores yet. Be the first to make the top five.';
  ui.leaderboardStatus.textContent = leaderboard.status;
}

function renderTimer() {
  const seconds = Math.max(0, game.remainingMs) / 1000;
  ui.time.textContent = seconds.toFixed(1);
  ui.timeTrack.setAttribute('aria-valuenow', seconds.toFixed(1));
  ui.timeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, seconds / (ROUND_TIME_MS / 1000)))})`;
  ui.timeFill.classList.toggle('is-low', seconds < 3);
}

function renderScore() {
  ui.score.textContent = game.score.toLocaleString();
  ui.round.textContent = String(game.round).padStart(2, '0');
}

function renderStratagem() {
  const current = game.roundItems[game.solved];
  ui.progress.textContent = `${game.solved} / ${game.roundItems.length}`;
  if (!current) return;
  ui.name.textContent = current.name;
  ui.category.textContent = current.category || 'Stratagem';
  if (current.icon) {
    ui.icon.onerror = () => { ui.icon.hidden = true; };
    ui.icon.src = current.icon;
    ui.icon.hidden = false;
  } else {
    ui.icon.hidden = true;
    ui.icon.removeAttribute('src');
  }
  ui.code.replaceChildren();
  current.sequence.forEach((direction, index) => {
    const arrow = document.createElement('span');
    arrow.className = `code-arrow${index < game.inputIndex ? ' is-entered' : ''}`;
    arrow.textContent = ARROWS[direction];
    arrow.setAttribute('aria-label', direction);
    ui.code.append(arrow);
  });
  renderQueue();
}

function renderQueue() {
  ui.queue.replaceChildren();
  const upcoming = game.roundItems.slice(game.solved + 1);
  upcoming.slice(0, 3).forEach((item, index) => {
    const row = document.createElement('li');
    row.className = 'queue-item';
    const number = document.createElement('span');
    number.textContent = `${String(game.solved + index + 2).padStart(2, '0')}.`;
    row.append(number, document.createTextNode(item.name));
    ui.queue.append(row);
  });
  if (upcoming.length > 3) {
    const extra = document.createElement('li');
    extra.className = 'queue-item queue-extra';
    extra.textContent = `+ ${upcoming.length - 3} more`;
    ui.queue.append(extra);
  }
}

function setSession(active) {
  if (active) {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = '';
  }
  document.documentElement.classList.toggle('game-in-progress', active);
  document.body.classList.toggle('is-in-session', active);
}

function beginGame() {
  if (pool.length < 6) {
    setFeedback('Stratagem data is unavailable. Reload the page and try again.', true);
    return;
  }
  game.generation++;
  cancelAnimationFrame(game.animationId);
  clearTimeout(game.summaryTimeout);
  game.round = 1;
  game.score = 0;
  game.phase = 'ready';
  setSession(true);
  ui.startOverlay.hidden = true;
  ui.gameOver.hidden = true;
  ui.summary.hidden = true;
  ui.publishForm.hidden = true;
  ui.publishNote.textContent = '';
  ui.playerName.value = '';
  renderScore();
  beginRound();
}

function beginRound() {
  game.roundItems = shuffle(pool).slice(0, Math.min(16, game.round + 5, pool.length));
  game.solved = 0;
  game.inputIndex = 0;
  game.mistakes = 0;
  game.remainingMs = ROUND_TIME_MS;
  game.previousFrame = performance.now();
  game.phase = 'playing';
  ui.summary.hidden = true;
  setFeedback('Enter the highlighted stratagem code.');
  renderScore();
  renderTimer();
  renderStratagem();
  game.animationId = requestAnimationFrame(tick);
}

function tick(now) {
  if (game.phase !== 'playing') return;
  game.remainingMs -= Math.max(0, now - game.previousFrame);
  game.previousFrame = now;
  if (game.remainingMs <= 0) {
    game.remainingMs = 0;
    renderTimer();
    finishGame();
    return;
  }
  renderTimer();
  game.animationId = requestAnimationFrame(tick);
}

function processDirection(direction) {
  if (game.phase === 'ready') {
    beginGame(); // As in the cabinet, a directional input may start a new game.
    return;
  }
  if (game.phase !== 'playing') return;
  const current = game.roundItems[game.solved];
  if (!current) return;
  if (direction !== current.sequence[game.inputIndex]) {
    game.inputIndex = 0;
    game.mistakes++;
    setFeedback('Incorrect input. Restart this code.', true);
    renderStratagem();
    return;
  }
  game.inputIndex++;
  if (game.inputIndex < current.sequence.length) {
    setFeedback('Input accepted.');
    renderStratagem();
    return;
  }
  game.score += 25;
  game.solved++;
  game.inputIndex = 0;
  game.remainingMs = Math.min(ROUND_TIME_MS, game.remainingMs + TIME_RESTORED_MS);
  renderScore();
  renderTimer();
  if (game.solved === game.roundItems.length) {
    finishRound();
  } else {
    setFeedback(`${current.name} dispatched. +25 points, +1 second.`);
    renderStratagem();
  }
}

function finishRound() {
  game.phase = 'summary';
  cancelAnimationFrame(game.animationId);
  const roundBonus = 50 + 25 * game.round;
  const timeBonus = Math.min(99, Math.max(0, Math.floor(game.remainingMs / ROUND_TIME_MS * 100)));
  const perfectBonus = game.mistakes === 0 ? 100 : 0;
  game.score += roundBonus + timeBonus + perfectBonus;
  renderScore();
  ui.summaryRound.textContent = `+${roundBonus}`;
  ui.summaryTime.textContent = `+${timeBonus}`;
  ui.summaryPerfect.textContent = `+${perfectBonus}`;
  ui.summaryTotal.textContent = game.score.toLocaleString();
  ui.summaryHeading.textContent = game.mistakes === 0 ? 'Perfect execution' : 'Democracy delivered';
  ui.summary.hidden = false;
  const generation = game.generation;
  game.summaryTimeout = setTimeout(() => {
    if (game.generation !== generation || game.phase !== 'summary') return;
    game.round++;
    beginRound();
  }, ROUND_SUMMARY_MS);
}

async function finishGame(reason = 'time') {
  if (game.phase === 'over') return;
  game.phase = 'over';
  cancelAnimationFrame(game.animationId);
  clearTimeout(game.summaryTimeout);
  setSession(false);
  ui.summary.hidden = true;
  ui.finalScore.textContent = game.score.toLocaleString();
  ui.gameOverMessage.textContent = reason === 'quit' ? 'Run ended. Checking the top five…' : 'Checking whether your score reached the top five…';
  ui.publishForm.hidden = true;
  ui.publishNote.textContent = '';
  ui.gameOver.hidden = false;
  const generation = game.generation;
  await leaderboard.refresh();
  if (generation !== game.generation || game.phase !== 'over') return;
  renderLeaderboard();
  if (leaderboard.qualifies(game.score)) {
    ui.gameOverMessage.textContent = 'You made the top five. Add your name to publish this score, or skip to leave it unsaved.';
    ui.publishForm.hidden = false;
  } else {
    ui.gameOverMessage.textContent = reason === 'quit' ?
      `Run ended in round ${game.round}. Keep training to enter the top five.` :
      `You reached round ${game.round}. Keep training to enter the top five.`;
  }
}

document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
  const direction = KEY_DIRECTIONS[event.key] || KEY_DIRECTIONS[event.key.toLowerCase()];
  if (!direction) return;
  if (game.phase === 'playing' || game.phase === 'ready') event.preventDefault();
  processDirection(direction);
});

document.querySelectorAll('.dpad [data-dir]').forEach(button => {
  button.addEventListener('click', () => processDirection(button.dataset.dir));
});

element('startButton').addEventListener('click', beginGame);
element('restartButton').addEventListener('click', beginGame);
element('quitButton').addEventListener('click', () => {
  if (game.phase === 'ready') {
    window.location.href = './index.html';
  } else if (game.phase === 'playing' || game.phase === 'summary') {
    finishGame('quit');
  }
});
element('skipButton').addEventListener('click', () => {
  ui.publishForm.hidden = true;
  ui.publishNote.textContent = 'Score left unpublished.';
});

ui.publishForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (game.phase !== 'over') return;
  ui.publishButton.disabled = true;
  ui.publishNote.textContent = 'Publishing score…';
  const generation = game.generation;
  try {
    const result = await leaderboard.publish(ui.playerName.value, game.score, game.round);
    if (game.generation !== generation) return;
    renderLeaderboard();
    if (result.accepted) {
      ui.publishForm.hidden = true;
      ui.publishNote.textContent = result.scope === 'shared' ?
        'Published to the shared top five.' : 'Saved to the top five on this device.';
    } else {
      ui.publishNote.textContent = result.reason;
      if (result.reason?.includes('top five')) ui.publishForm.hidden = true;
    }
  } catch (error) {
    if (game.generation === generation) ui.publishNote.textContent = error.message;
  } finally {
    ui.publishButton.disabled = false;
  }
});

if (pool.length < 6) {
  element('startButton').disabled = true;
  setFeedback('At least six stratagems with codes are needed to play.', true);
}
leaderboard.refresh().then(renderLeaderboard);