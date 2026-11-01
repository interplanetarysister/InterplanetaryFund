# Pinned migration reference

These two files are exact, unmodified source bytes from read-only
`interplanetarysister/interplanetary-fund2` commit
`d681fb36c37f86de8d32a60f4350853d0c792f87`:

- `entry.ts.txt`: `base44/functions/geocodeCity/entry.ts`
- `accountGuard.ts.txt`: `base44/shared/accountGuard.ts`

`tests/geocode-city.test.js` asserts their SHA-256 digests and executes the
original handler/guard in an isolated VM. External Auth/database/geocoder
collaborators are test doubles. These tests prove local contract comparison,
not a live Base44 request, Supabase session, Cloudflare deployment, or browser
campaign save. The `.txt` files are test reference material, never runtime code.
