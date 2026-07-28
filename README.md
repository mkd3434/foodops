# FoodOps — 5-second food safety records for NZ cafés

**Live demo:** https://mkd3434.github.io/foodops/

A demand-test demo: replaces paper Food Control Plan records (fridge/freezer temps,
opening/closing checklists, corrective actions) with a phone-first web app.
One tap produces a council-verifier-ready **Verification Pack**.

- No backend — records live in localStorage on the device; works offline after first load
- Voice or number-pad temperature logging in under 10 seconds
- Out-of-range readings **cannot be saved** without a corrective action
- Seeded with 7 days of realistic history for "Bay Bean Café, Tauranga"
- Pilot signups: `/#signups` (hidden admin view + CSV export)

Plain HTML/CSS/JS. No build step. Deployed on GitHub Pages (main branch, root).
To deploy changes: edit, bump the cache version in `sw.js`, commit, push.
