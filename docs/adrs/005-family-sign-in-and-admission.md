# ADR-005: Family sign-in, admission and hosting

- **Status:** Accepted
- **Date:** 2026-09-25
- **Deciders:** Tom Haynes (admission, [PRD-004 Q-01](../prds/004-family-release.md#owner-decisions)); implementation choices by the coordinator under ADR-001
- **Amends:** [ADR-001](001-authentik-sign-in.md) by resolving its open library, session, logout and admission items (C-03–C-05)
- **Related requirements:** PRD-004 R-01–R-03, R-12, R-13

## Context and problem statement

ADR-001 selected Authentik OIDC as the only sign-in and left the implementation, session, logout and admission rules open. The first family release must show the children's real photos over the internet. It needs a concrete, testable boundary.

Two constraints shape the choice:

- **Secrets.** Agent sessions cannot create or edit 1Password items; the External Secrets token is read-only. A confidential client secret can only be delivered after the owner adds a field by hand.
- **Existing patterns.** The estate already reaches the internet for `*.haynesnetwork.com` through the Cloudflare tunnel and `traefik-external`. cigar-journal runs Better Auth `genericOAuth` against Authentik, with a strict callback and a fake identity-provider test.

## Decision drivers

- Only admitted household members reach the game or any photo.
- The identity key is stable and cannot be spoofed; no email or display-name keys.
- It can ship overnight without a new owner-entered secret and can be hardened later without a redesign.
- The fictional playtest and fixture mode stay separate and unchanged.

## Considered options

1. **In-app OIDC with a public PKCE client** plus Authentik application group bindings. *Selected.*
2. **In-app OIDC with a confidential client.** Blocked tonight by the read-only secret store. It remains the documented upgrade.
3. **Authentik forward-auth outpost in front of the app, with the app trusting forwarded identity headers.** Rejected: WO080 and DESIGN-009 forbid forwarded-header identity. An outpost alone gives the app no owner identity for household data.

## Decision outcome

**D-01 Protocol and client.** Better Auth 1.7 `genericOAuth` with provider id `authentik` and client id `haynes-quest`. The Authentik provider is `client_type: public`, uses PKCE S256, grants only `authorization_code`, and uses `sub_mode: user_uuid` with a per-provider issuer and the long-term RSA signing key. The only redirect URI is `https://quest.haynesnetwork.com/api/auth/callback/authentik`. If an optional `QUEST_OIDC_CLIENT_SECRET` is present, the app authenticates as a confidential client. Switching the Authentik provider to confidential is then a configuration change.

**D-02 Identity key.** A player is keyed by the immutable `(issuer, subject)` pair, with a database uniqueness constraint. Email, username and display name are display-only.

**D-03 Admission.** The Authentik application binds exactly the `authentik Admins` and `family` groups (`policy_engine_mode: any`), so nobody else can obtain a code. The app also checks the ID token's `groups` claim at every sign-in:

- `family` or `authentik Admins` admits the person;
- only `authentik Admins` grants the administrator role (child setup and photo changes).

A valid login without either group is rejected, and no session is created.

**D-04 Household.** The first release has one household: every admitted person sees the same children and journeys. A child's progress belongs to that child's journey, so it continues on any family device. Administrator actions are audited by player id in the database, never in logs.

**D-05 Sessions.** Sessions are stored in Postgres as an httpOnly, SameSite=Lax, Secure cookie.

- Absolute lifetime is seven days with no rolling extension. Re-authentication is normally silent through the existing Authentik browser session, and it re-checks group membership at least weekly.
- Removing someone from the Authentik groups blocks new sign-ins at once and ends access within seven days.
- The existing exact-Origin plus `X-Quest-Request` write guard stays.

**D-06 Logout.** Sign out deletes the game session and returns to the signed-out start screen with a link to sign in again. For a shared device, the parent menu offers "Sign out of Haynes Network too", which follows Authentik's end-session endpoint.

**D-07 Hosting.** The family release (the existing normal `haynes-quest` HelmRelease) runs without fixture mode at `quest.haynesnetwork.com` through `traefik-external` and the Cloudflare tunnel. `QUEST_APP_ORIGIN` equals that origin. Its network policy admits only `traefik-external` ingress and allows egress only to Postgres, the in-cluster Immich service and `authentik.haynesnetwork.com:443`. The isolated playtest release stays LAN-only, in fixture mode, and never receives Immich credentials.

**D-08 Photo credentials.** Only the family release mounts the existing `haynes-quest-immich` secret. The private subject-id HMAC key is derived from the session secret with HKDF and a fixed label, so no additional owner-entered secret is needed. Fixture mode still refuses Immich variables.

## Consequences

| ID | Consequence |
| --- | --- |
| C-01 | The public client relies on PKCE, the strict redirect URI and the group binding instead of a client secret. Another site could start a login with the client id, but it cannot redeem a code for its own redirect URI. Tracked hardening: add `OIDC_CLIENT_SECRET` to the `haynes-quest` 1Password item, then flip the provider to confidential. |
| C-02 | Membership in the Haynes Network `family` group becomes access to the children's photos, as Tom ruled. Portal role changes flow through Authentik group sync. |
| C-03 | The playtest keeps fixture sessions. Fixture sessions and family sessions are distinct types and never share data. |
| C-04 | Tests must cover callback tampering, missing groups, the non-admin role, expiry, logout and fixture isolation with a fake identity provider. The owner's actual first login is a live check he performs; it is never simulated as done. |

## Evidence and references

- [PRD-004](../prds/004-family-release.md) and [DESIGN-024](../designs/024-family-journeys.md).
- cigar-journal `packages/auth/src/auth.ts` and `oidc.test.ts` (the Better Auth genericOAuth + Authentik pattern, including the `/api/auth/callback/authentik` path in Better Auth 1.7).
- haynes-ops `kubernetes/main/apps/network/authentik/app/blueprints/90-cigar-journal-oidc.yaml` (provider blueprint) and `60-tautulli-frontdoor.yaml` (group bindings for `authentik Admins` and `family`).
