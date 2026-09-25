# Work order 107: Growth moves, vertical pieces and theme kits

- **Status:** In progress
- **Model / dispatch:** Native Claude Code subagent `claude-opus-5-5` (xhigh)
- **Context:** Fresh agent; self-contained brief
- **Required reading:** `AGENTS.md`, [DESIGN-025](../../docs/designs/025-growth-moves-and-vertical-courses.md) (the contract), DESIGN-006/011/019/020/021/022, `src/game/obby.ts`, `src/game/createGame.ts`, `src/shared/authored-level.ts`, `src/shared/editor-project.ts`, `src/shared/editor-sections.ts`, `src/game/scene.ts`, `src/game/casino-scene.ts`, `src/game/casino-tokens.ts`, `src/game/world-themes.ts`, `src/shared/adventure.ts` (abilities), `tests/game/authored-traversal-lib.ts`, `scripts/levels/editor.ts`
- **Worktree / branch:** `~/work/hq-growth-vertical` on `agent/hq-growth-vertical` from `origin/main`
- **Owned paths:** `src/game/obby.ts`, the jump/ability parts of `src/game/createGame.ts`, `src/shared/authored-level*.ts`, `src/shared/editor-*.ts` (new piece commands), `src/game/theme-kits.ts` (new), `src/game/casino-scene.ts` → registry, the token/trail generalization, `src/shared/abilities.ts` (new), matching tests. **Do not edit** `src/server/**` beyond what the validator needs, or `src/client/main.tsx`.

## Outcome and scope

Implement DESIGN-025 end to end for **new world projects only**:

1. **D-01 move ladder** in `stepObby`, driven by an explicit, frozen ability set. Export `abilitiesForAge(age)` from `src/shared/abilities.ts`; the family plan lane consumes it.
2. **D-02 visual growth.**
3. **D-03 ability-aware `requires` connections** in the validator, including the start-age rule and the practice-strip rule.
4. **D-04 pieces:** `lift`, `bounce-pad`, `crumble`, `decor`, in a new `authored-level-v4` document version, with editor/CLI commands (`piece.add` variants and `decor.add`/`decor.remove`) and `inspect` output.
5. **D-05 theme-kit registry.** `CasinoScene` becomes a registry entry with **pixel-identical** output for the existing Rat Casino. Trails extend to every v4 theme.

Rules:

- v1–v3 documents, published routes, frozen plans and their physics stay byte-identical.
- Existing tests must pass unchanged. Where a test pins an old version, add new tests rather than edit old expectations.
- Editor world projects that opt into v4 levels must replay deterministically.

Add a runtime hook so a plan with no ability set behaves exactly as today. The ephemeral editor playtest should grant moves by chapter recovered age for v4 worlds, so worlds can be tried in the fixture playtest before the family plan lands.

## Deliverables and verification

- Unit tests for each ladder boundary's physics, lift/bounce/crumble timing, validator accept/reject cases, and decor intersection.
- An autopilot demo world at `scripts/levels/examples/vertical-v4-demo.commands.json`, using every new piece. Its required edges are traversed with start-age moves only, and its branch edges with their declared move.
- A lockstep browser run of the demo in the ephemeral playtest, with before/after screenshots kept outside git or in a gallery only if public-safe.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm levels:validate` all pass.
- Open a PR, get green checks, squash-merge, and report the merge SHA, the new command vocabulary and the helper signatures for world generators.

## Handoff and recovery

Report the SHA, API/command list, known limits and anything deferred. If context runs short, push the branch with a `NOTES.md` checkpoint and report.
