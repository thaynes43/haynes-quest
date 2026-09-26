import type { GameFeedbackEvent } from "../game/types";
import type {
  CuePlaybackOptions,
  FamilyWorldCueId,
  GameplayFeedbackId,
  QuestAudio,
  ScareCueId,
} from "./audio";

/**
 * DESIGN-008: what each immediate gameplay event sounds like. Events from older
 * routes keep their exact playtest variants; the family world events and flags
 * (see `GameFeedbackEvent`) add the family world cues. A cue or loop may also
 * name one of DESIGN-027's scary-moment cues.
 *
 * This module holds only data and types from `./audio`, so a test that mocks
 * the audio owner can still use the real mapping.
 */
export type FeedbackSound =
  | {
      readonly kind: "feedback";
      readonly id: GameplayFeedbackId;
      /** Scales the preset's playback rate; omitted means the preset itself. */
      readonly pitch?: number;
    }
  | {
      readonly kind: "cue";
      readonly id: FamilyWorldCueId | ScareCueId;
      readonly options?: CuePlaybackOptions;
    }
  | {
      readonly kind: "loop";
      readonly id: FamilyWorldCueId | ScareCueId;
      readonly active: boolean;
    };

/**
 * An enemy's attack wind-up sound, keyed by the catalog model it renders.
 * Enemies without an entry wind up silently, as before.
 */
export const enemyAttackSounds: Readonly<Record<string, FamilyWorldCueId>> =
  Object.freeze({
    "honk-bus": "honk-bus-honk",
  });

/** The defeat poof plays a little under the existing defeat chime. */
export const POOF_UNDER_DEFEAT: CuePlaybackOptions = Object.freeze({
  gain: 0.75,
});

/** A quick run of tokens climbs in pitch, five steps at most (DESIGN-022). */
function tokenPitch(streak: number): number {
  return 1 + Math.min(streak, 5) * 0.04;
}

export function feedbackSounds(
  event: GameFeedbackEvent,
): readonly FeedbackSound[] {
  switch (event.type) {
    case "hit":
      return [{ kind: "feedback", id: "impact" }];
    case "defeat":
      return event.familyWorld
        ? [
            { kind: "feedback", id: "defeat" },
            { kind: "cue", id: "enemy-poof", options: POOF_UNDER_DEFEAT },
          ]
        : [{ kind: "feedback", id: "defeat" }];
    case "token":
      return [{ kind: "feedback", id: "token", pitch: tokenPitch(event.streak) }];
    case "ticket":
      // The casino keeps its distinct golden-ticket fanfare in every world.
      return event.theme !== undefined && event.theme !== "casino"
        ? [{ kind: "cue", id: "golden-ticket-sparkle" }]
        : [{ kind: "feedback", id: "ticket" }];
    case "bounce":
      return [{ kind: "cue", id: "bounce-pad-boing" }];
    case "double-jump":
      return [{ kind: "cue", id: "double-jump-whoosh" }];
    case "crumble":
      return [{ kind: "cue", id: "crumble-crack" }];
    case "lift-stop":
      return [{ kind: "cue", id: "lift-arrival-chime" }];
    case "glide":
      return [{ kind: "loop", id: "glide-wind", active: event.active }];
    case "windup": {
      const cue = Object.hasOwn(enemyAttackSounds, event.assetId)
        ? enemyAttackSounds[event.assetId]
        : undefined;
      return cue ? [{ kind: "cue", id: cue }] : [];
    }
    case "hurt":
      // The server's lower HP plays the impact when the save arrives.
      return [];
  }
}

/** Plays an event's sounds through the one audio owner. */
export function playFeedbackSounds(
  sound: Pick<QuestAudio, "feedback" | "cue" | "loop">,
  event: GameFeedbackEvent,
): void {
  for (const call of feedbackSounds(event)) {
    if (call.kind === "feedback")
      void (call.pitch === undefined
        ? sound.feedback(call.id)
        : sound.feedback(call.id, call.pitch));
    else if (call.kind === "cue")
      void (call.options
        ? sound.cue(call.id, call.options)
        : sound.cue(call.id));
    else void sound.loop(call.id, call.active);
  }
}

/**
 * Whether a status update's new jumps include one that did not already sound
 * as a bounce or double jump. Older routes report no launches, so any new jump
 * plays the jump cue exactly as before.
 */
export function plainJumpSinceLastStatus(
  jumps: number,
  launches: number,
): boolean {
  return jumps > 0 && jumps > launches;
}
