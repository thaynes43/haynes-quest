# PRD002: Level editor MVP

Status: Implementation scope from Tom's September 20, 2026 direction. The editor now precedes new enemy production. Astra owns architecture, UX and final review; GPT-5.6 Sol at Ultra handles ordinary development, with explicitly authorized Opus 5 sessions for parallel work and review.

## Outcome

A human or inexpensive language model can assemble worlds and obby courses from tested pieces without modifying game code. The MVP can recreate both currently shipped chapters, including their gameplay placements and progression. New mechanics and Blender assets remain separate expert work.

## Requirements

| ID | Requirement |
| --- | --- |
| R-01 | One portable, versioned project document is shared by the visual editor, agent commands, validation and playtesting. No embedded executable scripts. |
| R-02 | Include exact templates for The Block Party and Besties Obby. Preserve their geometry, motion, hazards, checkpoints, equipment, memories, friendlies, encounters, boss arenas, recovery and chapter transition behavior. |
| R-03 | Provide a visual 3D workspace with selection, grid, camera navigation, move controls and numeric properties. Authors can add, duplicate, move and delete supported course pieces, edit all gameplay anchors and connections, and undo/redo. |
| R-04 | Reuse the current runtime and validators. Invalid drafts remain editable, with actionable object/path errors; playtesting requires a valid frozen snapshot. Draft edits never rewrite shipped routes or an active playtest. |
| R-05 | Save work automatically in the current browser and provide explicit JSON export/import. Handle invalid files and unavailable/full browser storage without silent loss. Export is the durable, portable handoff between people and agents. |
| R-06 | Provide documented CLI commands and examples for templates, inspection, structured edits, validation and canonical export. Normal level assembly must not require a new asset, application build or large-model intervention. |
| R-07 | Playtest either chapter and the complete two-chapter journey using the real controls, collision, combat and memory gates. Leaving a test returns to the preserved draft. |
| R-08 | Keep this MVP on the isolated fictional playtest surface. No family-photo queries, user scripts, arbitrary asset URLs, new login methods or unauthenticated shared publishing service. |
| R-09 | Keep existing browser zoom prevention and input recovery. Desktop is the primary authoring surface; narrower screens retain accessible controls and numeric editing without page overflow. |
| R-10 | Merge and deploy a testable MVP, verify both untouched templates and a meaningful edited/exported/imported project, and publish a concise human/agent usage guide. |

## Parity and limits

Parity means equal resolved course and placement data plus the same playable mechanics, not a second renderer that merely resembles screenshots. Templates retain the existing two-chapter fictional roster, equipment, three memory roles per chapter and current art/foliage behavior. The editor changes layouts and placements; arbitrary campaign length, new enemy mechanics, final-art approval, multi-user editing and account-synced publishing are later platform decisions. Browser-local drafts do not claim cross-device persistence; exported files provide portability.

Acceptance covers template round trips, deterministic command edits, rejection of malformed/unsafe data, runtime snapshot isolation, visual authoring, undo/redo, draft restoration, import/export, and actual edited playtesting. A graph validator cannot establish that a course is enjoyable; the Playtest action remains part of authoring.
