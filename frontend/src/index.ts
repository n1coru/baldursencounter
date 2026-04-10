import './styles.css';

// Dynamic import for WASM module
let wasmModule: typeof import('./wasm/dice_wasm') | null = null;

interface RollResult {
  rolls: number[];
  total: number;
  modifier: number;
  grand_total: number;
  dice_type: number;
  count: number;
}

// ── Config ──────────────────────────────────────────────────────────────────
const SESSION_KEY = 'bg_session_date';

interface SessionConfig {
  sessionDate: string;  // ISO 8601, e.g. "2026-04-18T19:00:00"
  sessionName: string;
}

async function loadConfig(): Promise<SessionConfig | null> {
  try {
    const res = await fetch('/session.config.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json() as SessionConfig;
  } catch {
    return null;
  }
}

// Priority: localStorage (user override) > session.config.json > fallback
async function resolveSessionDate(): Promise<{ date: Date; name: string }> {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) {
    const d = new Date(stored);
    if (!isNaN(d.getTime())) return { date: d, name: 'Next Session' };
  }

  const cfg = await loadConfig();
  if (cfg?.sessionDate) {
    const d = new Date(cfg.sessionDate);
    if (!isNaN(d.getTime())) {
      return { date: d, name: cfg.sessionName ?? 'Next Session' };
    }
  }

  // Last resort: next Saturday 19:00 local
  const now = new Date();
  const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSat);
  next.setHours(19, 0, 0, 0);
  return { date: next, name: 'Next Session' };
}

function saveSessionDate(date: Date) {
  localStorage.setItem(SESSION_KEY, date.toISOString());
}

// ── Countdown ────────────────────────────────────────────────────────────────
let sessionDate = new Date();
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function updateCountdown() {
  const el = document.getElementById('countdown-display')!;
  const labelEl = document.getElementById('countdown-label')!;
  const now = Date.now();
  const target = sessionDate.getTime();

  if (wasmModule) {
    const secs = wasmModule.seconds_until(target, now);
    if (secs <= 0) {
      el.textContent = "IT'S TIME TO ROLL!";
      el.classList.add('pulse');
      labelEl.textContent = 'THE ADVENTURE BEGINS!';
    } else {
      el.textContent = wasmModule.format_countdown(secs);
      el.classList.remove('pulse');
      // Dramatic label based on time left
      if (secs < 3600) {
        labelEl.textContent = 'ALMOST TIME, ADVENTURER!';
      } else if (secs < 86400) {
        labelEl.textContent = 'TODAY IS THE DAY!';
      } else {
        labelEl.textContent = 'NEXT SESSION IN:';
      }
    }
  }
}

// ── Dice Rolling ─────────────────────────────────────────────────────────────
interface DiceConfig {
  faces: number;
  label: string;
  symbol: string;
  color: string;
}

const DICE: DiceConfig[] = [
  { faces: 4,   label: 'D4',   symbol: '▲', color: '#8B4513' },
  { faces: 6,   label: 'D6',   symbol: '⬡', color: '#4B0082' },
  { faces: 8,   label: 'D8',   symbol: '◆', color: '#006400' },
  { faces: 10,  label: 'D10',  symbol: '⬟', color: '#8B0000' },
  { faces: 12,  label: 'D12',  symbol: '⬠', color: '#00008B' },
  { faces: 20,  label: 'D20',  symbol: '⬡', color: '#8B6914' },
  { faces: 100, label: 'D100', symbol: '%', color: '#4A4A4A' },
];

let currentCount = 1;
let currentModifier = 0;
let selectedFaces = 20;
let rolling = false;

function rollDice(faces: number) {
  if (!wasmModule || rolling) return;
  rolling = true;

  const btn = document.querySelector(`[data-faces="${faces}"]`) as HTMLElement;
  if (btn) btn.classList.add('rolling');

  // Animate random numbers briefly
  const resultEl = document.getElementById('roll-result')!;
  const summaryEl = document.getElementById('roll-summary')!;
  resultEl.classList.remove('critical', 'fumble', 'good');
  resultEl.textContent = '?';

  let ticks = 0;
  const maxTicks = 8;
  const tickInterval = setInterval(() => {
    const fake = Math.floor(Math.random() * faces) + 1;
    resultEl.textContent = String(fake);
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(tickInterval);
      finishRoll(faces, btn, resultEl, summaryEl);
    }
  }, 60);
}

function finishRoll(
  faces: number,
  btn: HTMLElement | null,
  resultEl: HTMLElement,
  summaryEl: HTMLElement
) {
  if (!wasmModule) return;

  const result: RollResult = wasmModule.roll_dice(currentCount, faces, currentModifier) as RollResult;

  resultEl.textContent = String(result.grand_total);

  // Color coding
  if (faces === 20 && result.rolls[0] === 20) {
    resultEl.classList.add('critical');
    summaryEl.textContent = '✨ NATURAL 20 — CRITICAL HIT! ✨';
  } else if (faces === 20 && result.rolls[0] === 1) {
    resultEl.classList.add('fumble');
    summaryEl.textContent = '💀 NATURAL 1 — CRITICAL FUMBLE! 💀';
  } else if (result.grand_total >= Math.ceil(faces * 0.75)) {
    resultEl.classList.add('good');
    summaryEl.textContent = buildSummary(result);
  } else {
    summaryEl.textContent = buildSummary(result);
  }

  // Push to history
  addToHistory(result, faces);

  if (btn) btn.classList.remove('rolling');
  rolling = false;
}

function buildSummary(r: RollResult): string {
  let s = `${r.count}d${r.dice_type}: [${r.rolls.join(', ')}]`;
  if (r.modifier !== 0) {
    s += ` ${r.modifier >= 0 ? '+' : ''}${r.modifier} = ${r.grand_total}`;
  }
  return s;
}

function addToHistory(r: RollResult, faces: number) {
  const list = document.getElementById('history-list')!;
  const item = document.createElement('li');
  const isNat20 = faces === 20 && r.rolls[0] === 20 && r.count === 1;
  const isNat1 = faces === 20 && r.rolls[0] === 1 && r.count === 1;

  item.innerHTML = `
    <span class="hist-dice">d${faces}</span>
    <span class="hist-rolls">[${r.rolls.join(', ')}]</span>
    <span class="hist-total ${isNat20 ? 'critical' : isNat1 ? 'fumble' : ''}">${r.grand_total}</span>
  `;

  list.insertBefore(item, list.firstChild);
  // Keep last 20
  while (list.children.length > 20) {
    list.removeChild(list.lastChild!);
  }
}

// ── Date Editor ──────────────────────────────────────────────────────────────
function setupDateEditor() {
  const btn = document.getElementById('edit-date-btn')!;
  const panel = document.getElementById('date-editor')!;
  const input = document.getElementById('session-input') as HTMLInputElement;
  const saveBtn = document.getElementById('save-date-btn')!;
  const cancelBtn = document.getElementById('cancel-date-btn')!;

  // Set input to current session date
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = sessionDate;
  input.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  btn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });

  saveBtn.addEventListener('click', () => {
    const newDate = new Date(input.value);
    if (!isNaN(newDate.getTime())) {
      sessionDate = newDate;
      saveSessionDate(newDate);
      panel.classList.add('hidden');
      updateCountdown();
    }
  });

  cancelBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
  });
}

// ── DOM Setup ─────────────────────────────────────────────────────────────────
function setupDiceButtons() {
  const grid = document.getElementById('dice-grid')!;

  DICE.forEach(({ faces, label, symbol }) => {
    const btn = document.createElement('button');
    btn.className = 'dice-btn';
    btn.dataset.faces = String(faces);
    btn.innerHTML = `
      <span class="dice-symbol">${symbol}</span>
      <span class="dice-label">${label}</span>
    `;
    btn.addEventListener('click', () => {
      selectedFaces = faces;
      document.querySelectorAll('.dice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      rollDice(faces);
    });
    grid.appendChild(btn);
  });

  // Select d20 by default
  const d20btn = grid.querySelector('[data-faces="20"]') as HTMLElement;
  if (d20btn) d20btn.classList.add('selected');
}

function setupCountModifier() {
  const countInput = document.getElementById('dice-count') as HTMLInputElement;
  const modInput = document.getElementById('dice-modifier') as HTMLInputElement;
  const rollBtn = document.getElementById('roll-btn')!;

  countInput.addEventListener('change', () => {
    currentCount = Math.max(1, Math.min(20, parseInt(countInput.value) || 1));
    countInput.value = String(currentCount);
  });

  modInput.addEventListener('change', () => {
    currentModifier = Math.max(-99, Math.min(99, parseInt(modInput.value) || 0));
    modInput.value = String(currentModifier);
  });

  rollBtn.addEventListener('click', () => rollDice(selectedFaces));

  // Keyboard shortcut: Space to roll
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      rollDice(selectedFaces);
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Load WASM and config in parallel
  const [, resolved] = await Promise.all([
    import('./wasm/dice_wasm').then(m => {
      wasmModule = m;
      return (m as any).default?.();
    }).catch(e => console.error('WASM load failed:', e)),
    resolveSessionDate(),
  ]);

  sessionDate = resolved.date;
  // Show session name in the subtitle if provided in config
  const subtitle = document.querySelector('.site-subtitle');
  if (subtitle && resolved.name !== 'Next Session') {
    subtitle.textContent = resolved.name;
  }

  setupDiceButtons();
  setupCountModifier();
  setupDateEditor();
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);

  document.getElementById('loading')?.remove();
  document.getElementById('app')!.classList.remove('hidden');
}

init();
