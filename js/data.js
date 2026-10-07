const families = [
  { file: 'support-weapons', label: 'Support Weapons', accent: '#49adc9', prefix: 'SW', description: 'Heavy firepower for the front line.' },
  { file: 'orbital-strikes', label: 'Orbital Strikes', accent: '#ef8478', prefix: 'OS', description: 'Precision and saturation from orbit.' },
  { file: 'eagle-strikes', label: 'Eagle Strikes', accent: '#ef9e75', prefix: 'ES', description: 'Fast air support from Eagle One.' },
  { file: 'sentries', label: 'Sentries', accent: '#93bd75', prefix: 'SN', description: 'Automated defense for a secure perimeter.' },
  { file: 'emplacements-and-mines', label: 'Emplacements & Mines', accent: '#76b8aa', prefix: 'DF', description: 'Hold the line and shape the battlefield.' },
  { file: 'backpacks', label: 'Backpacks', accent: '#b2a2d3', prefix: 'BP', description: 'Equipment to carry into the fight.' },
  { file: 'vehicles', label: 'Vehicles', accent: '#c6ad62', prefix: 'VH', description: 'Armored mobility and heavy support.' },
  { file: 'mission-commands', label: 'Mission Commands', accent: '#d4d6c8', prefix: 'MC', description: 'Objectives, logistics and extraction.' },
];

const arrowToWord = { '↑': 'up', '↓': 'down', '←': 'left', '→': 'right', U: 'up', D: 'down', L: 'left', R: 'right' };
const fileUrl = (name) => new URL(`../data/${name}.json`, import.meta.url);
const fetchJson = async (name) => {
  const response = await fetch(fileUrl(name));
  if (!response.ok) throw new Error(`Unable to load ${name}: HTTP ${response.status}`);
  return response.json();
};

const [lists, sourced, overrides] = await Promise.all([
  Promise.all(families.map((family) => fetchJson(family.file))),
  fetchJson('stats-source').catch(() => ({})),
  fetchJson('verified-overrides').catch(() => ({})),
]);

export const categories = families.map((family, index) => ({
  ...family,
  entries: lists[index].map((entry) => {
    const stats = sourced[entry.id] || {};
    const correction = overrides[entry.id] || {};
    const combined = { ...entry, ...stats, ...correction };
    const rawCode = Array.isArray(combined.code) ? combined.code : [];
    return {
      ...combined,
      category: family.label,
      categoryId: family.file,
      accent: family.accent,
      code: rawCode.map((direction) => arrowToWord[direction] || String(direction).toLowerCase()).filter((direction) => ['up', 'down', 'left', 'right'].includes(direction)),
      icon: new URL(`../assets/icons/${entry.icon}`, import.meta.url).href,
    };
  }),
}));

export const stratagems = categories.flatMap((family) => family.entries);
export const dataAsOf = 'October 7, 2026';