# Repository conventions reviewed

- **Reviewed:** 2026-09-10

## References and what this project takes from them

| Repository | Useful precedent | Application here |
| --- | --- | --- |
| `haynesnetwork` | PRD → ADR → domain language → design → executable plan; stable IDs; a single handoff | Keep the document structure and traceability. Use `.agents/plans/` for plans. |
| `cigar-journal` | Short root `AGENTS.md`, `CLAUDE.md` pointing to it, concise document templates | Keep contributor instructions short and shared by both agents. |
| `libretto` | Focused app responsibilities and compact verification workflow | Add only the runtime components and checks this game's requirements justify. |
| `haynes-ops` | Separate GitOps deployment repository, app-template workloads, internal ingress, versioned images | Put future game manifests there; start from the existing local web-app pattern. |

The existing application stacks are references, not decisions for a 3D game. This scaffold does not inherit Next.js, Postgres, tRPC, a monorepo, an authentication system, or a game engine merely because a sibling uses it.

`haynesnetwork` also records an owner preference for each app to have its own visual identity. The game should share dependable engineering conventions and have a playful identity of its own.

## Source snapshots

- [haynesnetwork documentation process](https://github.com/thaynes43/haynesnetwork/blob/9a59854c98dfa1f9f7f9173fde0406d848cd7430/docs/PROCESS.md)
- [haynesnetwork visual identity rationale](https://github.com/thaynes43/haynesnetwork/blob/9a59854c98dfa1f9f7f9173fde0406d848cd7430/docs/designs/006-visual-identity.md)
- [cigar-journal contributor guide](https://github.com/thaynes43/cigar-journal/blob/4c6c0a2ba0370e2f3d30459c49bf2f88ee5a2db5/AGENTS.md)
- [libretto README](https://github.com/thaynes43/libretto/blob/a3647b14397d711b0e95d735f0e919cb33f21d49/README.md)
- [haynes-ops source snapshot](https://github.com/thaynes43/haynes-ops/tree/a979c381ecb15f7a290b19df557711e9c6c15ca4)
