# Top-five leaderboard setup

The website works immediately on GitHub Pages. Without a database, published high scores are kept in the current browser's local storage, and the game labels them **on this device only**. To make one shared top-five leaderboard for everyone:

1. Create a Supabase project at <https://supabase.com/>.
2. Open its **SQL Editor**, paste the contents of [`leaderboard.sql`](./leaderboard.sql), and run it once. This creates the score table, a public read policy, and an atomic submission function.
3. In **Settings → API Keys**, copy the project URL and a **publishable key** (`sb_publishable_…`). In [`js/config.js`](./js/config.js), set `supabaseUrl` and `supabasePublishableKey` to those values. **Never put a service-role or secret key in a public website.**
4. Commit and push the site files. In your GitHub repository's **Settings → Pages**, choose **Deploy from a branch**, select your publishing branch and the folder containing `index.html`, then save. Open the Pages URL and play a round to verify that the leaderboard says **Shared top five**.

The game checks the leaderboard at game over. A player is offered a name field only if the score could enter the top five. Nothing is saved if the player skips. On submission, the database checks again under a lock, rejects scores that no longer qualify, and retains exactly the best five entries. A name can hold one slot, replaced only by a higher score. Ties do not displace an existing fifth-place score.

If the shared database cannot be reached, the game says so and shows scores stored only in that browser. A failed shared submission asks the player to retry; it does not silently post the run to the local board.

## Practical limitation

A public, static game cannot prove that the browser actually earned a submitted score. The SQL function prevents direct table writes and limits storage to five entries, but a determined visitor can call the public submission endpoint with a fabricated number. A competition-grade board needs a server-authoritative game or verified replay, plus abuse controls. Supabase free-tier availability and limits can change; check the current plan before launch.