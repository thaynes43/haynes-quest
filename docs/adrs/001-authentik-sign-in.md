# ADR-001: Authentik as the sole sign-in provider

- **Status:** Accepted
- **Date:** 2026-09-10
- **Deciders:** Tom Haynes; OIDC pattern confirmed by repository source review
- **Related requirements:** [PRD-001 R-11](../prds/001-project-brief.md)

## Context and problem statement

Haynes Quest needs player sign-in. Tom directed it to use the same login approach as Haynes Network and to keep login limited to Authentik.

The reviewed Haynes Network implementation uses Authentik through OpenID Connect (OIDC) as its sole application sign-in provider. Its familiar Plex login happens upstream inside Authentik. Haynes Network uses Better Auth and database-backed application sessions; those implementation choices do not select the game's framework or storage.

## Decision drivers

- Use the household's existing identities and familiar sign-in experience.
- Keep Authentik as the only login provider exposed by the game.
- Preserve a separate application boundary while allowing existing Authentik browser sessions to provide single sign-on.

## Considered options

1. Use the existing Authentik service through OIDC, following Haynes Network's sign-in pattern. Selected by the owner's direction and the source review.
2. Introduce game-local passwords, a separate registration flow, or additional login providers. Excluded by the owner's direction; no implementation evaluation was needed.

## Decision outcome

Use **Authentik OIDC only** for player sign-in. Reuse the existing identity service and its upstream login experience. Do not add game-local passwords or another identity provider, and do not integrate directly with Plex as a second game login method.

Plan a dedicated Haynes Quest application/client registration in Authentik, with its own callback URLs, credentials, and game session. Single sign-on comes from the existing Authentik browser session; it does not require sharing Haynes Network's client secret, application cookies, or session database. Exact registration values and secret delivery belong in the later integration and deployment design.

This decision accepts the provider and protocol, not a runtime implementation. Authentication library, session storage and lifetime, login redirect and logout behavior, and player admission rules remain for subsequent design. No Authentik resources have been provisioned by this decision.

## Consequences

| ID | Consequence |
| --- | --- |
| C-01 | Players use their existing Authentik identities. The game has no separate password setup or recovery flow. |
| C-02 | The integration must support the existing Authentik sign-in experience and test both a fresh login and a browser with an existing Authentik session. |
| C-03 | The game needs its own OIDC registration and session integration before protected gameplay can work. This does not require adopting Haynes Network's framework or database. |
| C-04 | Authentication and admission remain distinct. Haynes Network's enrollment-front-door policy is not an approved audience policy for this family game; define permitted players before enabling access to gameplay and collectible photos. |
| C-05 | Session expiry and logout need explicit design and validation, including shared-device behavior. Haynes Network's provider logout with local fallback is a reference for that design. |

## Evidence and references

- Owner ruling, 2026-09-10: use the same login approach as Haynes Network, limited to Authentik.
- [PRD-001: Project brief](../prds/001-project-brief.md).
- [Haynes Network provider configuration](https://github.com/thaynes43/haynesnetwork/blob/9a59854c98dfa1f9f7f9173fde0406d848cd7430/packages/auth/src/config.ts#L12) and [login button](https://github.com/thaynes43/haynesnetwork/blob/9a59854c98dfa1f9f7f9173fde0406d848cd7430/apps/web/app/login/login-button.tsx#L20).
- [Haynes Network OIDC registration](https://github.com/thaynes43/haynesnetwork/blob/9a59854c98dfa1f9f7f9173fde0406d848cd7430/docs/ops/001-authentik-provisioning.md#L10) and [cross-application SSO pattern](https://github.com/thaynes43/haynesnetwork/blob/9a59854c98dfa1f9f7f9173fde0406d848cd7430/docs/designs/041-sso-immersion-estate-auto-login.md#L15).
- [Haynes Network logout handling](https://github.com/thaynes43/haynesnetwork/blob/9a59854c98dfa1f9f7f9173fde0406d848cd7430/packages/auth/src/logout.ts#L177) and [enrollment-front-door policy reference](https://github.com/thaynes43/haynesnetwork/blob/9a59854c98dfa1f9f7f9173fde0406d848cd7430/docs/adrs/085-derived-authentik-application-bindings.md#L105).

Sibling references were reviewed at the pinned source snapshot above; this was not a live authentication or authorization audit.
