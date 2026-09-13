# DESIGN014: The Bickering Besties encounter

The Besties are a duo boss built around a pink-versus-black obstacle challenge. They take turns, encourage each other too loudly, and miss their high-five. The player can attack whenever either actor is in range; the missed high-five supplies a generous safe pause. [DESIGN018](018-familiar-touch-and-recovery.md) supersedes the original dizzy-only damage gate after the child playtest.

Tom selected the duo boss and alternating routine, then approved the joint pink-and-black concept on September 11, 2026. [Their review](../assets/reviews/bickering-besties/v001.md) preserves that concept and the exact model candidates.

## A readable routine

| Phase | Duration | Player response |
| --- | ---: | --- |
| Pink announces her trick | 1.2 seconds | Watch the highlighted sweep area |
| Pink moves a low foam bar | 2 seconds | Jump over it or move aside |
| Black announces her lane | 1.2 seconds | Find the clear half of the island |
| Black lights one floor lane | 2 seconds | Stay on the clear side or jump |
| They miss their high-five | 1.6 seconds | A safe pause to keep attacking |
| Both become dizzy | 5 seconds | Attack either side of the shared boss |

Only one trick can hurt the player at a time, and each trick can register at most one contact. Warning shapes match the forthcoming danger area. Black alternates sides each cycle; at least two metres of clear ground remain available. Airborne feet above 0.35 metres avoid contact. Help, memories and friendly conversations pause the world. Falling uses the existing nearby checkpoint and retains gear and victories. A fall or background interruption restarts an active trick with its full harmless warning, preserving the selected lane and any hit already charged for that trick. Ordinary menus freeze the current phase.

PLAN008 corrects that earlier permanently safe approach in fresh v3 playtests. At each warning, Pink chooses the player's current depth within the fight island and shows the whole cross-island sweep corridor; Black chooses a lane around the player's current side, including the center. The chosen geometry stays fixed through the warning and attack, leaving time and space to escape. Archived encounters retain their original fixed geometry. Warnings and the dizzy window keep their existing durations.

Fable's real-app review then showed that the newly connecting four-health tricks left a child only one recovery window before a third contact knocked them out. Fresh v3 Besties plans now use two health per contact, giving a full-health player two complete routines to learn and attack before a fifth contact can knock them out. This is the forgiving opening-playtest tuning; future difficulty is authored explicitly. Existing frozen plans, other bosses, player damage and retry rules remain unchanged.

Rendered actors and melee/ranged target checks share the same resolved actor positions, including the step into a trick and the missed high-five. An accepted hit animates the struck actor. Defeat takes precedence over combat becoming inactive, so the pair finish their defeat animation and disappear instead of returning to a standing idle pose. The boss objective/bar distinguishes approaching the arena from an active fight. Broader arena and course construction remain DESIGN016, rather than a new handcrafted campaign in this repair.

The two models share one boss health bar, one defeated flag and one memory reward. Spell feedback lands on the nearer visible actor. Regular attack targeting excludes the friendly residents. Boss victory releases the pictures without changing age; deliberately absorbing the completed bundle advances the journey as specified in DESIGN010.

## Saved journeys and eligible abilities

The initial Besties release used immutable `parody-catalog-v3`. PLAN011 selects new safe-practice courses through catalog v5; catalogs v1–v4 and their published route IDs remain frozen. The Besties period is `besties-obby-v1`; it requires both movement and jumping and uses the existing gentle jump course. The fixture's 2024 chapter selects this period after the first bundle unlocks jumping. A journey beginning in 2024 without jumping uses the existing, compatible remix roster. The older v1/v2 catalogs remain frozen, including the dragon encounter in existing v2 saves.

The logical boss identity is `bickering-besties@v001`. Its renderer uses `bestie-pink@v001` and `bestie-black@v001`; each has its own catalog card, GLB, source and review. They stand on opposite sides of the shared centre and approach to 0.90 metres apart for the high-five. Their authored hands miss slightly in height and depth.

The current browser simulation owns obstacle timing and proximity, as it does for the other playtest encounters. The server owns health, cooldowns, defeat, saved state and memory progression. This private family prototype does not claim server-side anti-cheat enforcement of a synchronized boss clock.

## Validation

Verify warning and clear-lane geometry, jump avoidance, one contact per trick, in-range damage throughout every phase, pause/resume and joint defeat. Check actual touch controls through the second boss, retained dragon saves, visible attack feedback and both exported models. Asset format and simulated touch checks remain distinct from physical iPhone/iPad Safari and the children's creative review.

The struck actor is captured only when the action coordinator accepts the attack. A later rejected press, including a busy press from the other side while the response is in flight, must not change that recipient. A level change or retry clears it. This keeps the visible hit reaction attached to the accepted hit despite response delay.
