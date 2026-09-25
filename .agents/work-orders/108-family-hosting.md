# Work order 108: Family hosting and Authentik (haynes-ops)

- **Status:** In progress (draft PR; merge after WO106 and WO109 land in a signed image)
- **Model / dispatch:** PLAN-019 Claude coordinator
- **Required reading:** [ADR-005](../../docs/adrs/005-family-sign-in-and-admission.md) D-01, D-03, D-07 and D-08; haynes-ops `AGENTS.md`/`CLAUDE.md`; haynes-ops `kubernetes/main/apps/frontend/haynes-quest/**`; the `90-cigar-journal-oidc.yaml` and `60-tautulli-frontdoor.yaml` blueprints; the cigar-journal `ingressroute.yaml` and `networkpolicy.yaml`
- **Worktree / branch:** `~/work/haynes-ops-quest-family` on `agent/haynes-quest-family-release`
- **Owned paths:** haynes-ops `kubernetes/main/apps/frontend/haynes-quest/**`, and one new Authentik blueprint plus its kustomization entry

## Outcome and scope

1. **Authentik blueprint.** An OAuth2 provider `haynes-quest`:
   - `client_type: public`, `client_id: haynes-quest`, `authorization_code` only;
   - strict redirect `https://quest.haynesnetwork.com/api/auth/callback/authentik`;
   - scopes openid, profile and email (profile carries `groups`);
   - `sub_mode: user_uuid`, per-provider issuer, long-term RSA key.

   Plus an application `haynes-quest` with `policy_engine_mode: any` and bindings to `authentik Admins` (order 0) and `family` (order 10).
2. **Family release** (`helmrelease.yaml`):
   - the new signed image;
   - `QUEST_FIXTURE_MODE` removed and `NODE_ENV=production`;
   - `QUEST_APP_ORIGIN=https://quest.haynesnetwork.com`;
   - the `QUEST_OIDC_*` env vars;
   - `NODE_OPTIONS=--dns-result-order=ipv4first`;
   - `envFrom` gains `haynes-quest-immich-secret`.
3. **`traefik-external` IngressRoute** for `quest.haynesnetwork.com` (`certificate-haynesnetwork`, external-dns target `ingress-ext.haynesnetwork.com`). Keep or retire the LAN hostname: it cannot share the single Origin, so redirect it to the external host.
4. **Network policy:**
   - ingress from `traefik-external` on 3000 (confirm the live label);
   - egress to Postgres, `immich-server.photos:2283` and `authentik.haynesnetwork.com:443` through `toFQDNs` with DNS `matchName`.
5. **Playtest** is pinned to the same image and stays in fixture mode, LAN-only.
6. **Optional:** a Gatus external check.

## Verification

- `kustomize build` of both kustomizations.
- After merge:
  - Flux `Ready`; the HelmRelease is on the expected generation;
  - the pod is Ready with zero restarts;
  - `curl -I https://quest.haynesnetwork.com/` responds;
  - sign-in redirects to Authentik with the correct `client_id`, PKCE and redirect;
  - the Authentik application shows exactly the two bindings.
- Declare activity for `frontend/haynes-quest` before the switch.
