# ADR-006: Playtest isolation and the family host's public surface

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** The coordinator, resolving the September 26 family release review. Each decision enforces an existing owner requirement (PRD-004 R-01, R-12, R-13) and ADR-005's accepted intent; none adds an owner ruling.
- **Amends:** [ADR-005](005-family-sign-in-and-admission.md) D-07 (the playtest's hosting boundary) and D-08 (the session secret's scope)
- **Related requirements:** PRD-004 R-01, R-12, R-13, AC-01

## Context and problem statement

The September 26 release review reproduced two gaps between the accepted documents and the live release.

1. **The playtest shared the family release's secrets.** ADR-005 D-07 calls the LAN playtest "isolated", and C-03 says fixture and family sessions "never share data". The playtest nevertheless mounted the family release's application Secret:
   - it held the family `DATABASE_URL`, with read and write access to children, birthdays, drafts and publications;
   - it held the family `BETTER_AUTH_SECRET`, which signs family session cookies and seeds the subject-id and candidate-token keys (ADR-005 D-08);
   - its network policy allowed egress to the family Postgres.

   The ephemeral playtest uses neither the database nor the family keys. A compromise of that less-trusted fixture process running in development mode would have exposed all family data and allowed forged family sessions.
2. **The studio was public on the family host.** PRD-004 R-01 and AC-01 say the family host is reachable only after Authentik sign-in. Anonymous clients could still read `/studio/*`: the project docs, the asset catalog, and the model and audio files the game loads. Everything there comes from this public repository, so nothing private leaked, but the release did not match the requirement.

## Decision drivers

- A fixture process must not be able to reach family data or family session keys, even if it is compromised.
- The family host should match R-01 as written, without a new reading that would need an owner ruling.
- The fictional playtest and fixture mode keep working (R-13).
- The app should fail closed when a deployment gets this wrong, not trust the deployment to stay right.

## Considered options

1. **Give the playtest its own Secret with a separate session secret.** This works, but it leaves one more Secret to provision and rotate for a process that keeps nothing across restarts.
2. **Give the playtest no Secret at all. The app refuses a database URL in ephemeral mode and mints its own session secret.** *Selected.* The in-memory store already loses every session on restart, so a per-process secret loses nothing.
3. **For the studio, reword AC-01 to list the studio as a public surface.** Rejected. It would reinterpret the owner's R-01 without his ruling.
4. **For the studio, require a family session on the family host.** *Selected.* The game already loads the studio files only after sign-in, with same-origin credentials.

## Decision outcome

**D-01 Playtest isolation.** The playtest release receives nothing from the family release:

- no family Secret, so no `DATABASE_URL` and not the family `BETTER_AUTH_SECRET`;
- no database egress in its network policy.

The app enforces the configuration side. With `QUEST_EPHEMERAL_PLAYTEST=true` it refuses to start when `DATABASE_URL` is set. Without a `BETTER_AUTH_SECRET` it mints a random per-process session secret, because everything it signs lives in the memory store that a restart discards. The playtest HelmRelease therefore needs no Secret. The haynes-ops change that removes the playtest's Secret and its database egress must land before, or together with, the first image that carries this guard. Otherwise the playtest refuses to start.

**D-02 The family host's public surface.** Without a session, the family host answers only:

- the sign-in start: the app shell, with its bundled scripts, styles and icons;
- the Better Auth routes under `/api/auth/*`;
- the operational `/healthz` and `/readyz`, which carry no data.

`/studio/*` needs an admitted family session, like the API. That covers the docs, the asset catalog, and the model and audio files the game loads. Studio responses keep `Cache-Control: no-cache`, so the edge cannot serve them to anyone else. The fixture playtest still serves the same studio without a session on the LAN, for agents and reviewers who have no family account.

**D-03 Session secret scope.** The family `BETTER_AUTH_SECRET` belongs to the family release alone. Because the playtest held it, rotate it once D-01 is deployed. Rotation:

- ends every family session. Members sign in again, silently when their Authentik session is still valid;
- invalidates candidate tokens and person-choice ids already on an open admin screen;
- gives later publications different opaque photo references.

Published plans and saves keep loading and their photos keep serving. Media resolves through each save's server-side manifest, and nothing re-derives a frozen reference. Rotation needs an owner-entered 1Password value.

## Consequences

| ID | Consequence |
| --- | --- |
| C-01 | A compromise of the LAN fixture app no longer reaches family data or the family session keys. |
| C-02 | Asset review on the family host needs sign-in. The LAN playtest host (`haynes-quest-playtest.haynesops.com/studio/`) serves the same studio without it. The retired LAN host `haynes-quest.haynesops.com` redirects to the family host and must keep the request path. |
| C-03 | Each studio request on the family host costs a session lookup: two small indexed queries. That is acceptable for one household. A signed session-cookie cache would remove the cost if it is ever needed. |
| C-04 | Owner actions outside this repository, tracked with the release review:<br>- rotate the family `BETTER_AUTH_SECRET` (D-03);<br>- replace the shared, all-permission Immich key with a dedicated read-only key for the family release;<br>- enable HSTS at the Cloudflare edge, which currently sends `max-age=0` in place of the app's header. |

## Evidence and references

- The September 26 release review's confirmed findings. Live checks compared SHA-256 digests of the two pods' secrets without printing them, and ran read-only database counts from the playtest pod.
- [ADR-005](005-family-sign-in-and-admission.md) D-07, D-08 and C-03, [PRD-004](../prds/004-family-release.md) R-01 and AC-01, and [DESIGN-015](../designs/015-fresh-playtest-controls.md), under which ephemeral startup never connects to Postgres.
- `src/server/config.ts` (the ephemeral guard and the per-process secret) and `src/server/app.ts` (the studio gate), with their tests in `tests/server/config.test.ts` and `tests/server/family/routes.test.ts`.
