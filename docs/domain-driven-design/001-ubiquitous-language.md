# DDD-001: Ubiquitous language

- **Status:** Draft
- **Last updated:** 2026-09-10

These terms describe the initial brief. Add specific gameplay terms when the game design establishes them.

| ID | Term | Meaning |
| --- | --- | --- |
| T-01 | Player | A person playing the game; initially one of Tom's kids. |
| T-02 | Source photo | A photo obtained from a configured photo connection for character generation or game content. |
| T-03 | Collectible | An in-game item the player can collect. The initial brief identifies real photos as these items; their appearance and collection rules are undecided. |
| T-04 | Immich | The first supported self-hosted photo service, providing people records and source photos through a configured URL and API key. |
| T-05 | On-screen controls | Touch-operated gameplay controls displayed on the screen for touchscreen play. Their layout and actions will follow the gameplay design. |
| T-06 | Authentik | The existing identity provider used by Haynes Network and the sole sign-in provider selected for Haynes Quest. Successful sign-in identifies a person; the game's admission policy determines whether that person may play. |
| T-07 | Playable character | A game character derived from a configured person's photos and available for selection when ready. It has a stable game-owned identity, distinct from the signed-in player, the person's display name, and any generated model version. |
| T-08 | Saved game | One player's resumable game, retaining the selected character and recorded progress. A player may have multiple saved games. |
| T-09 | Character asset | The model, rig, materials, and animation clips used to display a playable character. Replacing an asset does not change the character's identity or invalidate its saved games. |
| T-10 | Photo connection | A user's configured service type, base URL, and protected credential reference used by the server to access a photo library. Account-private ownership is the proposed default. |
| T-11 | Configured person | A person selected by name in a photo connection and resolved to a stable upstream person ID within that connection. The same name can refer to different people or libraries. |
| T-12 | Generation job | A persisted background operation that turns a configured person's selected photos into a validated character asset version, with visible progress and a recoverable failure state. |

Immich's photo records and the game's collection state are separate concepts. This distinction does not choose a persistence model or require copying full photo originals.
