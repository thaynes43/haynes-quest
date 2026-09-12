import { describe, expect, it } from 'vitest';
import {
  ATTACK_COOLDOWN_MS,
  ROUTE_ATTACK_COOLDOWN_MS,
  createAdventurePlan,
  createInitialAdventureState,
  createRouteMemoryPlan,
  reduceAdventureAction,
  toAdventureView,
  type AdventureMemory,
  type AdventurePlanV3,
  type AdventureState,
} from '../../../src/shared/adventure.js';
import { createInitialFriendlyState, reduceFriendlyAction } from '../../../src/shared/friendly.js';
import type { GameplayAction } from '../../../src/shared/contracts.js';

const MEMORIES: AdventureMemory[] = [
  { id: 'memory-age-0', date: '2020-07-01', ageYears: 0 },
  { id: 'memory-age-2', date: '2022-01-01', ageYears: 2 },
  { id: 'memory-age-4', date: '2024-01-01', ageYears: 4 },
  { id: 'memory-age-5', date: '2025-01-01', ageYears: 5 },
  { id: 'memory-age-6', date: '2026-01-01', ageYears: 6 },
  { id: 'memory-age-7', date: '2027-01-01', ageYears: 7 },
];

const plan = (): AdventurePlanV3 => createRouteMemoryPlan('2020-01-01', MEMORIES);

function act(p: AdventurePlanV3, s: AdventureState, action: GameplayAction, nowMs: number): AdventureState {
  return reduceAdventureAction(p, s, action, nowMs);
}

function code(run: () => unknown): string {
  try {
    run();
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
}

function armed(p: AdventurePlanV3, nowMs = 0): AdventureState {
  const level = p.levels[0]!;
  let state = createInitialAdventureState(p);
  for (const pickup of level.pickups) {
    state = act(p, state, { type: 'collect-equipment', levelId: level.id, pickupId: pickup.pickupId }, nowMs);
  }
  return state;
}

describe('WO068 probe: v3 gating', () => {
  it('gates majors, minors, phases and version-only actions', () => {
    const p = plan();
    const level = p.levels[0]!;
    const level2 = p.levels[1]!;
    let state = armed(p);
    const majorWhileExploring = code(() =>
      act(p, state, { type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId }, 0));
    const level2Minor = code(() =>
      act(p, state, { type: 'recover-memory', levelId: level.id, memoryId: level2.minorMemoryIds[0] }, 0));
    const guard = code(() => act(p, state, { type: 'guard', levelId: level.id }, 0));
    const consume = code(() => act(p, state, { type: 'consume-memory-bundle', levelId: level.id }, 0));

    // Beat the level to memory-released without picking up the minors.
    let nowMs = 0;
    for (const encounter of level.encounters) {
      while (!state.encounters[encounter.id]!.defeated) {
        state = act(p, state, { type: 'attack', levelId: level.id, encounterId: encounter.id }, nowMs);
        nowMs += ROUTE_ATTACK_COOLDOWN_MS;
      }
    }
    expect(state.phase).toBe('memory-released');
    const majorWithoutMinors = code(() =>
      act(p, state, { type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId }, nowMs));
    const takeHitReleased = code(() =>
      act(p, state, { type: 'take-hit', levelId: level.id, encounterId: level.encounters[0]!.id }, nowMs));
    const attackReleased = code(() =>
      act(p, state, { type: 'attack', levelId: level.id, encounterId: level.encounters[0]!.id }, nowMs));
    const minorAfterVictory = act(
      p, state, { type: 'recover-memory', levelId: level.id, memoryId: level.minorMemoryIds[0]! }, nowMs);

    const v2 = createAdventurePlan('2020-01-01', MEMORIES);
    const v2State = createInitialAdventureState(v2);
    const secondaryOnV2 = code(() =>
      reduceAdventureAction(v2, v2State, {
        type: 'secondary-attack', levelId: v2.levels[0]!.id, encounterId: v2.levels[0]!.encounters[0]!.id,
      }, 0));

    expect({
      majorWhileExploring, level2Minor, guard, consume,
      majorWithoutMinors, takeHitReleased, attackReleased,
      minorRevealed: minorAfterVictory.revealedMemoryIds, secondaryOnV2,
    }).toEqual({
      majorWhileExploring: 'ACTION_NOT_AVAILABLE',
      level2Minor: 'MEMORY_NOT_FOUND',
      guard: 'ACTION_NOT_AVAILABLE',
      consume: 'ACTION_NOT_AVAILABLE',
      majorWithoutMinors: 'MEMORY_BUNDLE_INCOMPLETE',
      takeHitReleased: 'ACTION_NOT_AVAILABLE',
      attackReleased: 'ACTION_NOT_AVAILABLE',
      minorRevealed: [level.minorMemoryIds[0]],
      secondaryOnV2: 'ACTION_NOT_AVAILABLE',
    });
  });

  it('does not report a phantom guard cooldown after a v3 secondary attack', () => {
    const p = plan();
    const level = p.levels[0]!;
    let state = armed(p);
    state = act(p, state, { type: 'secondary-attack', levelId: level.id, encounterId: level.encounters[0]!.id }, 1_000);
    const view = toAdventureView(p, state, 1_000);
    console.log('OBSERVED v3 view cooldowns', JSON.stringify({
      secondary: view.secondaryCooldownRemainingMs,
      guard: view.guardCooldownRemainingMs,
    }));
    expect(view.guardCooldownRemainingMs).toBe(0);
  });
});

describe('WO068 probe: attack-friendly cooldown crosses into v3 enemy attacks', () => {
  it('does not hand out a free enemy attack after harming a friendly', () => {
    const p = plan();
    const level = p.levels[0]!;
    const state = armed(p);
    const friendlyState = createInitialFriendlyState(p);
    const friendlyId = `${level.id}-friendly-blockling`;
    const harmedAt = 10_000;
    const harmed = reduceFriendlyAction(
      p, state, friendlyState, { type: 'attack-friendly', levelId: level.id, friendlyId }, harmedAt);
    expect(harmed.adventureState.attackReadyAtMs).toBe(harmedAt + ATTACK_COOLDOWN_MS);

    const immediate = code(() => act(p, harmed.adventureState, {
      type: 'attack', levelId: level.id, encounterId: level.encounters[0]!.id,
    }, harmedAt + 1));
    const afterRouteCooldown = code(() => act(p, harmed.adventureState, {
      type: 'attack', levelId: level.id, encounterId: level.encounters[0]!.id,
    }, harmedAt + ROUTE_ATTACK_COOLDOWN_MS));
    console.log('OBSERVED post-friendly enemy attack', immediate, afterRouteCooldown);
    expect({ immediate, afterRouteCooldown })
      .toEqual({ immediate: 'ATTACK_COOLDOWN', afterRouteCooldown: 'NO_ERROR' });
  });
});
