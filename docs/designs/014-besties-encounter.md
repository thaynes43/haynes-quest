# DESIGN014: The Bickering Besties encounter

The Besties are a duo boss built around a pink-versus-black obstacle challenge. They take turns, encourage each other too loudly, and miss their high-five. The player waits for that mistake, then uses the wand during a generous shared opening.

Tom selected the duo boss and alternating routine, then approved the joint pink-and-black concept on September 11, 2026. [Their review](../assets/reviews/bickering-besties/v001.md) preserves that concept and the exact model candidates.

## A readable routine

| Phase | Duration | Player response |
| --- | ---: | --- |
| Pink announces her trick | 1.2 seconds | Watch the highlighted sweep area |
| Pink moves a low foam bar | 2 seconds | Jump over it or move aside |
| Black announces her lane | 1.2 seconds | Find the clear half of the island |
| Black lights one floor lane | 2 seconds | Stay on the clear side or jump |
| They miss their high-five | 1.6 seconds | A safe pause before attacking |
| Both become dizzy | 5 seconds | Attack either side of the shared boss |

Only one trick can hurt the player at a time, and each trick can register at most one contact. Warning shapes match the forthcoming danger area. Black alternates sides each cycle; at least two metres of clear ground remain available. Airborne feet above 0.35 metres avoid contact. Help, memories and friendly conversations pause the world. Falling uses the existing nearby checkpoint and retains gear and victories. A fall or background interruption restarts an active trick with its full harmless warning, preserving the selected lane and any hit already charged for that trick. Ordinary menus freeze the current phase.

The wand deliberately reaches beyond the obstacles, leaving a forgiving approach and retreat area. The timed dizzy opening still governs attacks from there. Harder arena pressure belongs to later age-based content.

The two models share one boss health bar, one defeated flag and one memory reward. Spell feedback lands on the nearer visible actor. Regular attack targeting excludes the friendly residents. Boss victory releases the pictures without changing age; deliberately absorbing the completed bundle advances the journey as specified in DESIGN010.

## Saved journeys and eligible abilities

New journeys use immutable `parody-catalog-v3`. The Besties period is `besties-obby-v1`; it requires both movement and jumping and uses the existing gentle jump course. The fixture's 2024 chapter selects this period after the first bundle unlocks jumping. A journey beginning in 2024 without jumping uses the existing, compatible remix roster. The older v1/v2 catalogs remain frozen, including the dragon encounter in existing v2 saves.

The logical boss identity is `bickering-besties@v001`. Its renderer uses `bestie-pink@v001` and `bestie-black@v001`; each has its own catalog card, GLB, source and review. They stand on opposite sides of the shared centre and approach to 0.90 metres apart for the high-five. Their authored hands miss slightly in height and depth.

The current browser simulation owns obstacle timing and proximity, as it does for the other playtest encounters. The server owns health, cooldowns, defeat, saved state and memory progression. This private family prototype does not claim server-side anti-cheat enforcement of a synchronized boss clock.

## Validation

Verify warning and clear-lane geometry, jump avoidance, one contact per trick, the exclusive dizzy attack window, pause/resume and joint defeat. Check actual touch controls through the second boss, retained dragon saves, visible attack feedback and both exported models. Asset format and simulated touch checks remain distinct from physical iPhone/iPad Safari and the children's creative review.
