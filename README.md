# The Elements of Managed Democracy

A static, mobile-friendly Helldivers 2 fan atlas and playable Stratagem Hero recreation. The supplied 36:16 vector desk mat is the entire interactive homepage. All 109 printed tiles are clickable; their exact positions are mapped in `data/tile-layout.json`. The supplied SVG archive provides one actual stratagem icon per tile and for each detail view.

## Publish with GitHub Pages

1. Unzip this package and put **the contents of this folder** at the root of a GitHub repository. `index.html`, `game.html`, `data/`, `js/`, and `assets/` should be alongside this README.
2. Commit and push. In the repository's **Settings → Pages**, choose **Deploy from a branch**, select the branch and **/(root)**, then save. If you prefer `/docs`, move all site contents into that folder and choose it as the Pages source.
3. Open the Pages URL. The homepage is `index.html`; the **Stratagem Hero** link opens `game.html`. Relative URLs also work for a repository site at `username.github.io/repository/`.
4. For a shared top five across players, follow [LEADERBOARD_SETUP.md](./LEADERBOARD_SETUP.md). The game labels scores **on this device only** until configured. No one can publish a score unless it qualifies for the current top five and they choose to enter a name.

You can preview locally with `python -m http.server 8000` from this folder and open `http://localhost:8000`. ES modules and JSON loading need HTTP; opening `index.html` as a `file://` page will not load the data in most browsers.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `atlas.css`, `js/home.js` | Full-page periodic chart, positioned clickable tiles, search, pan/zoom, and detail dialog |
| `game.html`, `js/game.js` | Arcade game and mobile directional pad |
| `styles.css` | Shared game-page styles from the initial design |
| `data/tile-layout.json` | Exact 3600 × 1600 chart coordinates for 109 interactive tiles |
| `data/support-weapons.json` | 33 support weapons |
| `data/orbital-strikes.json` | 12 orbital strikes |
| `data/eagle-strikes.json` | 8 Eagle strikes |
| `data/sentries.json` | 10 sentries |
| `data/emplacements-and-mines.json` | 8 emplacements and mines |
| `data/backpacks.json` | 13 backpacks |
| `data/vehicles.json` | 9 vehicles |
| `data/mission-commands.json` | 16 mission commands |
| `data/stats-source.json` | Source-backed call-in codes, cooldowns, costs and available weapon stats, keyed by tile ID |
| `data/verified-overrides.json` | Later official/wiki corrections applied over the baseline |
| `js/data.js` | Loads and combines family records, baseline stats, and overrides |
| `js/leaderboard.js`, `js/config.js`, `leaderboard.sql` | Local/shared top-five logic and optional database setup |
| `assets/desk-mat-vector.svg` | Supplied vector mat shown as the homepage canvas |
| `assets/icons/` | The 109 supplied stratagem SVGs |

To edit a stratagem's displayed name, edit its family file. To move its clickable area on the chart, edit the same ID in `data/tile-layout.json`; its coordinates use the vector mat's 3600 × 1600 viewBox. To correct a stat after a patch, add a sourced entry to `data/verified-overrides.json` using the same `id`. To add a new stratagem, update the chart art and layout map as well as its family file, icon, and stats record. The game draws only entries with verified directional codes and excludes entries marked unavailable or deprecated.

The chart fills the homepage without the former editorial sections. Desktop starts fitted to the available area. On narrow or touch screens it starts enlarged for readable tiles; swipe the chart to pan, use `+` and `−` to zoom, `FIT` for an overview, or search to jump directly to a stratagem. The Stratagem Hero link appears in the chart and in the always-visible control strip.

## Data and game rules

The data was checked on **October 7, 2026 UTC**. Every tile has a source-linked code and base cooldown. Sources do not consistently publish call-in times or limited-use counts, so the detail dialog marks missing values **Unverified**. Base stats may change with ship upgrades, mission modifiers, campaign events, and future patches. [STAT_SOURCES.md](./data/STAT_SOURCES.md) documents the data collection and corrections. The source catalog has two additional mission entries absent from the supplied 109-tile design; the site follows the supplied design.

For mission commands, a source cooldown of zero is shown as **N/A** rather than implying that the command can be repeatedly called with no delay.

Stratagem Hero starts at six randomly selected codes, adds one per round to a cap of 16, resets the current code after a wrong direction, and ends when the timer expires. Keyboard arrows and WASD work on desktop; a directional pad appears on narrow or touch displays. The exact timer and bonus formulas are not publicly documented, so the playable recreation uses ten seconds per round, restores one second per code, awards 25 points per code, and adds a round, remaining-time, and perfect-round bonus. Those timing and bonus figures are approximations. The site scoreboard is a custom top five; the in-game cabinet's leaderboard rules differ.

## Attribution

The atlas is an unofficial fan project, inspired by the desk mat provided with this task. Stratagem icons were provided in the [nvigneux SVG collection](https://github.com/nvigneux/Helldivers-2-Stratagems-icons-svg), whose README permits use in projects. Data was gathered from [DiversHub](https://divershub.app/database/stratagems), with corrections checked against [The Helldivers Wiki](https://helldivers.wiki.gg/wiki/Stratagems) and [Arrowhead patch notes](https://arrowhead.zendesk.com/hc/en-us/sections/12541923508380-Patch-Notes). DiversHub credits wiki content under CC BY-NC-SA; this package includes numeric facts and original UI text, not copied descriptions. Helldivers 2 is owned by Arrowhead Game Studios and Sony Interactive Entertainment.