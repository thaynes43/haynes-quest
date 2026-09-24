import React, { useEffect, useRef, useState } from "react";
import type {
  GameplayAction,
  GameplayActionRequest,
  MemoryView,
  SaveView,
} from "../shared/contracts";
import { createGame } from "../game/index";
import { getJoystickVector } from "../game/input";
import type {
  AuthoredLevelResolver,
  GameHandle,
  GameStatus,
} from "../game/index";
import type { GameInputAction } from "../game/types";
import { api, friendlyError } from "./api";

import { QuestAudio } from "./audio";
import { MemoryImage } from "./MemoryImage";
import { draftEncounterLabel, equipmentName, eraStory } from "./era";

// Touch and pen activate the browser on release; starting a resume promise on
// pointerdown can strand it before the valid gesture reaches the audio engine.
function canUnlockAudio(event?: Event): boolean {
  return (
    event?.type !== "pointerdown" ||
    (event as PointerEvent).pointerType === "mouse"
  );
}

const friendlyNames: Record<string, string> = {
  blockling: "Blockling",
  "signal-moth": "Signal Moth",
  "buffer-baron": "Buffer Baron",
  "loop-dancer": "Loop Dancer",
  "prism-mimic": "Prism Mimic",
  trendweaver: "Trendweaver",
};

/** Preview-only presentation; omitting these leaves ordinary private play unchanged. */
export interface GameScreenPreviewProps {
  /** Resolves the active route's authored document from a frozen snapshot. */
  authoredLevelResolver?: AuthoredLevelResolver;
  /** Replaces the label and accessible name of every leave control. */
  leaveLabel?: string;
  /** Chapter display names keyed by route ID; labels only, never mechanics. */
  chapterTitles?: Readonly<Partial<Record<string, string>>>;
  chapterSubtitles?: Readonly<Partial<Record<string, string>>>;
  /** Author-written introduction for each preview route. */
  chapterDescriptions?: Readonly<Partial<Record<string, string>>>;
  /** A chapter-only trial shows only memories earned in its selected chapter. */
  chapterOnlyRouteId?: string;
}

export function GameScreen({
  initialSave,
  onLeave,
  ephemeral = false,
  authoredLevelResolver,
  leaveLabel,
  chapterTitles,
  chapterSubtitles,
  chapterDescriptions,
  chapterOnlyRouteId,
}: {
  initialSave: SaveView;
  onLeave: () => void;
  ephemeral?: boolean;
} & GameScreenPreviewProps) {
  return initialSave.format === "legacy-v1" ? (
    <LegacyJourney
      save={initialSave}
      onLeave={onLeave}
      leaveLabel={leaveLabel}
    />
  ) : (
    <Adventure
      initialSave={initialSave}
      onLeave={onLeave}
      ephemeral={ephemeral}
      authoredLevelResolver={authoredLevelResolver}
      leaveLabel={leaveLabel}
      chapterTitles={chapterTitles}
      chapterSubtitles={chapterSubtitles}
      chapterDescriptions={chapterDescriptions}
      chapterOnlyRouteId={chapterOnlyRouteId}
    />
  );
}

function LegacyJourney({
  save,
  onLeave,
  leaveLabel,
}: {
  save: SaveView;
  onLeave: () => void;
  leaveLabel?: string;
}) {
  return (
    <main className="legacy-journey">
      <span className="eyebrow">EARLIER PROTOTYPE · SAVED ALBUM</span>
      <h1>{save.title}</h1>
      <p>
        This journey belongs to the earlier memory-walking prototype. Your
        pictures and progress are preserved. Start a new journey to play
        equipment, era enemies and bosses.
      </p>
      <p>
        Age {save.ageYears} · {save.recoveredIds.length} memories remembered
      </p>
      <div className="memory-grid">
        {save.memories
          .filter((memory) => save.recoveredIds.includes(memory.id))
          .map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
      </div>
      <button className="primary" onClick={onLeave}>
        {leaveLabel ?? "Back to your journeys"}
      </button>
    </main>
  );
}

function MemoryCard({
  memory,
  children,
}: {
  memory: MemoryView;
  children?: React.ReactNode;
}) {
  return (
    <figure className="victory-memory">
      <MemoryImage memory={memory} />
      <figcaption>
        <strong>{memory.label}</strong>
        <small>
          {memory.date} · Age {memory.ageYears} · Fictional illustration
        </small>
      </figcaption>
      {children}
    </figure>
  );
}

function Adventure({
  initialSave,
  onLeave,
  ephemeral = false,
  authoredLevelResolver,
  leaveLabel,
  chapterTitles,
  chapterSubtitles,
  chapterDescriptions,
  chapterOnlyRouteId,
}: {
  initialSave: SaveView;
  onLeave: () => void;
  ephemeral?: boolean;
} & GameScreenPreviewProps) {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<GameHandle | undefined>(undefined);
  const [save, setSave] = useState(initialSave);
  const [status, setStatus] = useState<GameStatus>();
  const [error, setError] = useState("");
  const [friendDialogId, setFriendDialogId] = useState<string | null>(null);
  const [confirmFriendlyHarm, setConfirmFriendlyHarm] = useState(false);
  const soundRef = useRef<QuestAudio | undefined>(undefined);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [soundTest, setSoundTest] = useState<
    "idle" | "starting" | "played" | "failed"
  >("idle");
  const soundTestAttempt = useRef(0);
  const soundOff = muted || volume === 0;
  const [showHelp, setShowHelp] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [showVictory, setShowVictory] = useState(
    initialSave.adventure?.phase === "memory-released" &&
      !initialSave.adventure.activeLevel?.majorMemoryId,
  );
  const [chapterNotice, setChapterNotice] = useState("");
  const [chapterMemoryId, setChapterMemoryId] = useState<string | null>(null);
  const [photoDetail, setPhotoDetail] = useState<string | null>(null);
  const mounted = useRef(true);
  const latest = useRef(initialSave);
  const requestBusy = useRef(false);
  const recoveryRequested = useRef<string | null>(null);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const victoryOpen = useRef(showVictory);
  victoryOpen.current = showVictory;
  const view = save.adventure!;
  const level = view.activeLevel;
  const initialLevel = initialSave.adventure?.activeLevel;
  const selectedPreviewLevel =
    chapterOnlyRouteId &&
    initialLevel?.routeId === chapterOnlyRouteId &&
    initialLevel.majorMemoryId
      ? initialLevel
      : null;
  const selectedMemoryIds = selectedPreviewLevel
    ? new Set([
        ...(selectedPreviewLevel.minorMemoryIds ?? []),
        ...(selectedPreviewLevel.majorMemoryId
          ? [selectedPreviewLevel.majorMemoryId]
          : []),
      ])
    : null;
  const visibleMemories = selectedMemoryIds
    ? save.memories.filter((memory) => selectedMemoryIds.has(memory.id))
    : save.memories;
  const visibleRecoveredCount = visibleMemories.filter((memory) =>
    save.recoveredIds.includes(memory.id),
  ).length;
  const routeMemories = Boolean(level?.majorMemoryId);
  const minorCount = save.memories.filter(
    (memory) =>
      level?.minorMemoryIds?.includes(memory.id) &&
      ["revealed", "consumed"].includes(memory.state ?? ""),
  ).length;
  const story = eraStory(level?.eraYear, level);
  const chapterTitle =
    (level?.routeId ? chapterTitles?.[level.routeId] : undefined) ??
    story.title;
  const chapterDescription =
    (level?.routeId ? chapterDescriptions?.[level.routeId] : undefined) ??
    story.description;
  const chapterSubtitle =
    level?.routeId ? chapterSubtitles?.[level.routeId] : undefined;
  const previewChapterCount = selectedMemoryIds
    ? 1
    : level?.totalLevels ?? Math.max(1, Math.ceil(save.memories.length / 3));
  const hasDraftEnemy = level?.encounters.some(
    (encounter) => encounter.content?.placeholder === "neutral-candidate-v1",
  );
  const bundle = save.memories.filter((memory) =>
    level?.memoryIds.includes(memory.id),
  );
  const allRevealed =
    bundle.length > 0 &&
    bundle.every(
      (memory) => memory.state === "revealed" || memory.state === "consumed",
    );
  const weapon = view.inventory.find((item) => item.id === view.equippedId);
  const shield = view.inventory
    .filter((item) => item.kind === "guard-tool" && item.collected)
    .sort((a, b) => b.tier - a.tier)[0];
  const boss = level?.encounters.find((enemy) => enemy.role === "boss");
  const nearbyPickup = level?.pickups.find(
    (pickup) => pickup.pickupId === status?.nearPickupId,
  );
  const nearbyFriend = level?.friendlies?.find(
    (friend) => friend.id === status?.nearFriendlyId,
  );
  const selectedFriend = level?.friendlies?.find(
    (friend) => friend.id === friendDialogId,
  );
  const target = level?.encounters.find(
    (enemy) => enemy.id === status?.nearEncounterId,
  );
  const draftTargetName = draftEncounterLabel(
    level?.encounters,
    status?.nearEncounterId,
  );

  useEffect(() => {
    mounted.current = true;
    let previousRequestError: string | null = null;
    let previousAttackSequence = -1;
    let previouslyGrounded = true;
    let previousJumpSequence = 0;
    const sound = new QuestAudio();
    soundRef.current = sound;
    setMuted(sound.preferences().muted);
    setVolume(sound.preferences().volume);
    const audioGesture = (event: Event) => {
      if (!canUnlockAudio(event)) return;
      void sound.start({ confirmation: true });
    };
    document.addEventListener("pointerdown", audioGesture, true);
    document.addEventListener("pointerup", audioGesture, true);
    document.addEventListener("touchend", audioGesture, true);
    document.addEventListener("click", audioGesture, true);
    document.addEventListener("keydown", audioGesture, true);
    const update = (next: SaveView, action?: GameplayAction) => {
      if (
        !mounted.current ||
        next.id !== initialSave.id ||
        next.revision < latest.current.revision
      )
        return next;
      const before = latest.current;
      latest.current = next;
      setSave(next);
      setError("");
      if (next.revision > before.revision) {
        if (
          action?.type === "recover-memory" &&
          before.memories.find((memory) => memory.id === action.memoryId)
            ?.role === "minor"
        )
          void sound.feedback("pickup");
        else if (
          action?.type === "recover-memory" &&
          next.ageYears === before.ageYears
        )
          void sound.cue("memory-collected");
        if (action?.type === "consume-memory-bundle")
          void sound.cue("ability-unlocked");
        if (action?.type === "collect-equipment") {
          void sound.feedback("pickup");
        }
        const enemyHit = next.adventure?.activeLevel?.encounters.some(
          (enemy) =>
            enemy.hp <
            (before.adventure?.activeLevel?.encounters.find(
              (prior) => prior.id === enemy.id,
            )?.hp ?? enemy.hp),
        );
        if (
          enemyHit ||
          (next.adventure?.playerHp ?? 0) < (before.adventure?.playerHp ?? 0)
        ) {
          void sound.feedback("impact");
        }
        if (action?.type === "interact-friendly") {
          void sound.cue("ui-confirmed", { gain: 1, playbackRate: 1.1 });
        }
        if (action?.type === "attack-friendly") {
          setConfirmFriendlyHarm(false);
          setFriendDialogId(null);
        }
        if (action?.type === "guard")
          void sound.cue("ui-confirmed", { gain: 0.7, playbackRate: 0.85 });
      }
      if (
        action?.type === "recover-memory" &&
        !before.adventure?.activeLevel?.majorMemoryId &&
        before.adventure?.phase === "memory-released" &&
        !victoryOpen.current
      )
        setPhotoDetail(action.memoryId);
      if (
        (action?.type === "consume-memory-bundle" ||
          action?.type === "recover-memory") &&
        next.ageYears !== before.ageYears
      ) {
        setShowVictory(false);
        setPhotoDetail(null);
        if (action?.type === "recover-memory")
          setChapterMemoryId(action.memoryId);
        if (!next.completed)
          setChapterNotice(
            `Three memories brought you to age ${next.ageYears}. Your next chapter begins in ${next.adventure?.activeLevel?.eraYear}. Bring your gear and keep exploring!`,
          );
      }
      return next;
    };
    const act = async (request: GameplayActionRequest) => {
      requestBusy.current = true;
      try {
        return update(
          await api<SaveView>(`/saves/${initialSave.id}/actions`, request),
          request.action,
        );
      } finally {
        requestBusy.current = false;
      }
    };
    if (container.current) {
      try {
        game.current = createGame({
          container: container.current,
          save: initialSave,
          ...(authoredLevelResolver
            ? { authoredLevelResolver }
            : {}),
          onAction: act,
          onRefresh: async () =>
            update(await api<SaveView>(`/saves/${initialSave.id}`)),
          onStatus: (next) => {
            if (!mounted.current) return;
            if (
              !previouslyGrounded &&
              next.grounded &&
              ["exploring", "memory-released"].includes(next.phase)
            )
              void sound.feedback("landed");
            if ((next.jumpSequence ?? 0) > previousJumpSequence)
              void sound.feedback("jump");
            previousJumpSequence = next.jumpSequence ?? 0;
            previouslyGrounded = next.grounded;
            if (
              next.attackFeedback &&
              next.attackFeedback.sequence !== previousAttackSequence
            ) {
              previousAttackSequence = next.attackFeedback.sequence;
              const outcome = next.attackFeedback.outcome;
              if (["accepted", "no-target", "guarded"].includes(outcome))
                void sound.feedback(
                  next.attackFeedback.kind === "secondary"
                    ? "secondary"
                    : "attack",
                );
            }
            if (
              next.requestErrorCode &&
              next.requestErrorCode !== previousRequestError
            )
              setError(friendlyError(new Error(next.requestErrorCode)));
            previousRequestError = next.requestErrorCode;
            setStatus(next);
          },
        });
      } catch {
        setError(
          "This browser couldn’t open the 3D world. Try a browser with WebGL enabled.",
        );
      }
    }
    return () => {
      mounted.current = false;
      document.removeEventListener("pointerdown", audioGesture, true);
      document.removeEventListener("pointerup", audioGesture, true);
      document.removeEventListener("touchend", audioGesture, true);
      document.removeEventListener("click", audioGesture, true);
      document.removeEventListener("keydown", audioGesture, true);
      sound.dispose();
      soundRef.current = undefined;
      game.current?.dispose();
      game.current = undefined;
    };
  }, [initialSave]);

  const blockRecovery = () => {
    const code = game.current?.inspect().status.requestErrorCode;
    setError(
      code
        ? friendlyError(new Error(code))
        : "The checkpoint retry could not start. Please try again.",
    );
    setRecoveryBlocked(true);
  };

  useEffect(() => {
    if (view.phase !== "fallen") {
      recoveryRequested.current = null;
      setRecoveryBlocked(false);
      return;
    }
    if (!level || status?.requestBusy || requestBusy.current) return;
    const attempt = `${save.id}:${save.revision}`;
    if (recoveryRequested.current === attempt) {
      if (status?.requestState === "error") setRecoveryBlocked(true);
      return;
    }
    const timer = setTimeout(() => {
      recoveryRequested.current = attempt;
      if (
        !game.current?.performAction({ type: "retry-level", levelId: level.id })
      ) {
        blockRecovery();
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [
    view.phase,
    level,
    save.id,
    save.revision,
    status?.requestBusy,
    status?.requestState,
  ]);

  const activeModal = save.completed
    ? "complete"
    : view.phase === "fallen"
      ? "fallen"
      : showVictory && level && view.phase === "memory-released"
        ? "victory"
        : chapterNotice
          ? "chapter"
          : photoDetail
            ? "photo"
            : selectedFriend
              ? "friend"
              : showHelp
                ? "help"
                : showAlbum
                  ? "album"
                  : null;
  const modalOpen = activeModal !== null;
  useEffect(() => {
    game.current?.setPaused(modalOpen);
    soundRef.current?.setPaused(modalOpen);
    if (activeModal !== "chapter" && activeModal !== "complete") return;
    const sound = soundRef.current;
    if (!sound) return;
    let played = false;
    let pending = false;
    const celebrate = (event?: Event) => {
      if (!canUnlockAudio(event) || played || pending) return;
      pending = true;
      void sound.audition("ability-unlocked").then((started) => {
        played = started;
        pending = false;
      });
    };
    // An interrupted context waits for the next direct gesture; repeated
    // pointer/touch events share one pending celebration attempt.
    if (sound.status().contextState === "running") celebrate();
    const gestures = [
      "pointerdown",
      "pointerup",
      "touchend",
      "click",
      "keydown",
    ];
    for (const gesture of gestures)
      document.addEventListener(gesture, celebrate, true);
    return () => {
      for (const gesture of gestures)
        document.removeEventListener(gesture, celebrate, true);
    };
  }, [modalOpen, activeModal]);

  const feedback = (
    <>
      {error && (
        <div className="game-error" role="alert" data-quest-ui>
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {Boolean(status?.mediaFailed) && (
        <div className="media-warning" role="status" data-quest-ui>
          Some artwork couldn’t load.
          <button onClick={() => game.current?.retryMedia()}>
            Retry artwork
          </button>
        </div>
      )}
    </>
  );

  const perform = (action: GameplayAction) => {
    setError("");
    const accepted = game.current?.performAction(action);
    if (
      !accepted &&
      (action.type === "interact-friendly" || action.type === "attack-friendly")
    )
      setError("That action isn’t ready yet. Keep exploring and try again.");
  };
  const busy = status?.requestBusy ?? false;
  const actionInput = (action: GameInputAction, value: boolean) =>
    game.current?.setInput(action, value);
  const cancelActionInput = (action: GameInputAction) =>
    game.current?.cancelInput(action);
  const activePhoto = save.memories.find((memory) => memory.id === photoDetail);
  const leaveText =
    leaveLabel ?? (ephemeral ? "Leave playtest" : "Save & leave");

  return (
    <div
      className="game-screen era-game"
      data-period={level?.eraYear ?? "complete"}
    >
      <div className="game-canvas" ref={container} />
      <div className="game-vignette" />
      <header className="game-header" data-quest-ui>
        <button
          className="glass-button leave-button"
          aria-label={leaveText}
          disabled={busy || requestBusy.current}
          onClick={onLeave}
        >
          ← <span>{leaveText}</span>
        </button>
        <div className="chapter-pill">
          <span>{level?.eraYear ?? "JOURNEY COMPLETE"}</span>
          <strong>{level ? chapterTitle : "A life remembered"}</strong>
        </div>
        <div className="game-tools">
          <button
            className="glass-button"
            aria-label={soundOff ? "Enable sound" : "Mute sound"}
            onClick={() => {
              const next = !soundOff;
              const nextVolume = !next && volume === 0 ? 0.8 : volume;
              setMuted(next);
              setVolume(nextVolume);
              soundRef.current?.setPreferences(next, nextVolume);
              void soundRef.current?.start({ confirmation: true });
            }}
          >
            <span aria-hidden="true">{soundOff ? "♪̸" : "♪"}</span>
            <small>{soundOff ? "Sound off" : "Sound on"}</small>
          </button>
          <button
            className="glass-button"
            aria-label="Open your memories"
            onClick={() => setShowAlbum(true)}
          >
            <span aria-hidden="true">▧</span>
            <small>Memories</small>
          </button>
          <button
            className="glass-button"
            aria-label="How to play"
            onClick={() => setShowHelp(true)}
          >
            <span aria-hidden="true">?</span>
            <small>Help</small>
          </button>
        </div>
      </header>
      <aside className="era-hud" data-quest-ui>
        <div className="age-line">
          <strong>Age {save.ageYears}</strong>
          <span>
            {save.appearance.stage === "infant"
              ? "A small beginning"
              : "Childhood"}
          </span>
        </div>
        <div className="health-line">
          <span aria-hidden="true">♥</span>
          <meter
            min={0}
            max={view.maxPlayerHp}
            value={view.playerHp}
            aria-label="Health"
          />
          <b>
            {view.playerHp}/{view.maxPlayerHp}
          </b>
        </div>
        {routeMemories && (
          <div
            className="route-memory-count"
            aria-label={`${minorCount} of 2 little memories collected`}
          >
            <span className="memory-slots">
              {level?.minorMemoryIds?.map((id) => {
                const memory = save.memories.find((entry) => entry.id === id);
                const collected = save.recoveredIds.includes(id);
                return (
                  <span
                    key={id}
                    className={`memory-slot ${collected ? "collected" : ""}`}
                    aria-label={
                      collected ? "Memory collected" : "Memory to find"
                    }
                  >
                    {collected && memory ? (
                      <MemoryImage memory={memory} />
                    ) : (
                      <span aria-hidden="true">▧</span>
                    )}
                    {collected && <b aria-hidden="true">✓</b>}
                  </span>
                );
              })}
            </span>
            <b aria-hidden="true">{minorCount} / 2</b>
          </div>
        )}
        {routeMemories && view.phase === "memory-released" && (
          <p className="memory-next-step" role="status">
            {minorCount < 2
              ? `${2 - minorCount} little ${minorCount === 1 ? "memory" : "memories"} left. Follow the path back to find ${minorCount === 1 ? "it" : "them"}, then return to the big memory.`
              : "Walk into the big memory to finish this chapter."}
          </p>
        )}
        <div className="equipment-line">
          <span>✦ {equipmentName(weapon)}</span>
          {shield && <span>◈ {equipmentName(shield)}</span>}
        </div>
      </aside>
      {boss &&
        boss.available !== false &&
        view.phase === "exploring" &&
        status?.bossEngaged && (
          <div className="boss-hud">
            <span>{story.enemies.boss}</span>
            <meter
              min={0}
              max={boss.maxHp}
              value={boss.hp}
              aria-label="Boss health"
            />
            <small>
              {boss.hp} / {boss.maxHp}
            </small>
          </div>
        )}
      {!modalOpen && draftTargetName && view.phase === "exploring" && (
        <div className="target-hint" data-encounter-id={target?.id}>
          <strong>{draftTargetName}</strong>
          <small>Current target · draft character</small>
        </div>
      )}
      {!modalOpen && feedback}
      {!modalOpen && (
        <div className="game-bottom" data-quest-ui>
          <Joystick game={game} />
          <div className="keyboard-hint">
            <span>WASD</span> move <span>SPACE</span> jump <span>F</span> attack{" "}
            <span>SHIFT</span> secondary
          </div>
          <div className="combat-actions">
            <ActionButton
              action="jump"
              label="Jump"
              symbol={
                <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <path
                    d="M16 25V7m-8 8 8-8 8 8"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              input={actionInput}
              cancelInput={cancelActionInput}
            />
            {shield && (
              <ActionButton
                action="guard"
                label={routeMemories ? "Bash" : "Guard"}
                symbol="◈"
                disabled={!shield || view.phase !== "exploring"}
                active={status?.guardReady}
                input={actionInput}
                cancelInput={cancelActionInput}
              />
            )}
            <ActionButton
              action="attack"
              label="Attack"
              symbol="✦"
              disabled={view.phase !== "exploring"}
              active={Boolean(target && status?.attackReady)}
              input={actionInput}
              cancelInput={cancelActionInput}
            />
          </div>
          {!routeMemories &&
            (nearbyPickup || status?.nearMemoryId || nearbyFriend) && (
              <div className="legacy-contact-action">
                <ActionButton
                  action="interact"
                  label={
                    nearbyPickup
                      ? "Take gear"
                      : nearbyFriend
                        ? "Say hello"
                        : "Remember"
                  }
                  symbol="+"
                  input={actionInput}
                  cancelInput={cancelActionInput}
                />
              </div>
            )}
        </div>
      )}
      {nearbyFriend && !nearbyPickup && !modalOpen && (
        <button
          className="friendly-prompt"
          data-quest-ui
          onClick={() => {
            const handle = game.current;
            if (handle?.inspect().status.nearFriendlyId !== nearbyFriend.id) {
              setError("Land beside your friend to say hello.");
              return;
            }
            // Freeze the validated position now, before React opens the dialog.
            handle.setPaused(true);
            setFriendDialogId(nearbyFriend.id);
            setConfirmFriendlyHarm(false);
          }}
        >
          <strong>♥ {friendlyNames[nearbyFriend.assetId] ?? "A friend"}</strong>
          <span>
            {nearbyFriend.penaltyActive
              ? "Make amends"
              : nearbyFriend.boonClaimed
                ? "Your friend is resting"
                : "A friendly face · healing help"}
          </span>
        </button>
      )}
      {nearbyPickup && !modalOpen && (
        <div className="pickup-prompt" data-quest-ui>
          <strong>{equipmentName(nearbyPickup)}</strong>
          <span>
            {nearbyPickup.kind === "attack-tool"
              ? nearbyPickup.tier > 1
                ? "Ranged magic · aims at nearby enemies"
                : `${nearbyPickup.damage} strength · equips when collected`
              : routeMemories
                ? "A close-range bash for your second attack"
                : "Soften incoming hits with a well-timed guard"}
          </span>
        </div>
      )}
      {view.phase === "memory-released" && !routeMemories && !modalOpen && (
        <button
          className="open-victory primary"
          data-quest-ui
          onClick={() => setShowVictory(true)}
        >
          Reclaim your memories
        </button>
      )}
      <div className="placeholder-label" data-quest-ui>
        {previewChapterCount} {previewChapterCount === 1 ? "chapter" : "chapters"} · Fictional memories · {hasDraftEnemy ? "Draft enemy uses placeholder art" : "Candidate artwork"}
      </div>

      {activeModal === "friend" && selectedFriend && level && (
        <Modal
          notice={feedback}
          title={friendlyNames[selectedFriend.assetId] ?? "A friendly face"}
          eyebrow="A FRIEND ON YOUR JOURNEY"
          onClose={() => {
            setFriendDialogId(null);
            setConfirmFriendlyHarm(false);
          }}
        >
          {confirmFriendlyHarm ? (
            <>
              <p>
                This character is your friend. Harming them costs you up to 2
                health and pauses their help until you make amends.
              </p>
              <button
                className="primary"
                onClick={() => setConfirmFriendlyHarm(false)}
              >
                Leave them be
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  perform({
                    type: "attack-friendly",
                    levelId: level.id,
                    friendlyId: selectedFriend.id,
                  })
                }
              >
                Attack anyway
              </button>
            </>
          ) : (
            <>
              <p>
                {selectedFriend.penaltyActive
                  ? selectedFriend.defeated
                    ? "Your friend is knocked out. Make amends to help them up and restore your friendship."
                    : "That hurt your friend, and cost you health. Make amends to restore your friendship."
                  : selectedFriend.boonClaimed
                    ? "Your friend has shared their healing gift for this chapter. They’re happy to see you again."
                    : "Say hello to recover up to 2 health. Your friend saves this gift until you need it."}
              </p>
              {selectedFriend.penaltyActive && (
                <p>
                  Friend’s health: {selectedFriend.hp}/{selectedFriend.maxHp}.
                  Your memories and equipment are safe.
                </p>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  (!selectedFriend.penaltyActive &&
                    (selectedFriend.boonClaimed ||
                      view.playerHp === view.maxPlayerHp))
                }
                onClick={() =>
                  perform({
                    type: "interact-friendly",
                    levelId: level.id,
                    friendlyId: selectedFriend.id,
                  })
                }
              >
                {selectedFriend.penaltyActive
                  ? "Make amends"
                  : selectedFriend.boonClaimed
                    ? "Gift already shared"
                    : view.playerHp === view.maxPlayerHp
                      ? "You’re already healthy"
                      : "Say hello · +2 health"}
              </button>
              <button
                className="secondary"
                onClick={() => setFriendDialogId(null)}
              >
                Keep exploring
              </button>
              {weapon &&
                !selectedFriend.defeated &&
                view.phase === "exploring" && (
                  <button
                    className="friend-harm"
                    disabled={busy}
                    onClick={() => setConfirmFriendlyHarm(true)}
                  >
                    Hurt this friend…
                  </button>
                )}
            </>
          )}
        </Modal>
      )}

      {activeModal === "help" && (
        <Modal
          notice={feedback}
          title="Explore. Prepare. Face the era."
          eyebrow="HOW TO PLAY"
          onClose={() => setShowHelp(false)}
        >
          <p>
            Walk into glowing gear and pictures to collect them. Find two little
            memories along the path, beat the boss, then collect the big memory
            to grow older and enter the next chapter.
          </p>
          <p>
            Move with the left stick and press the arrow button on the right to
            jump. You can use both thumbs together. Drag the world to look
            around. Practice hopping up and down the low steps; a missed
            practice jump lands on safe ground.
          </p>
          <p>
            Attack hits a nearby enemy. Your second button, Bash, uses a shield
            for a close-range second hit. Step out of danger while it recharges.
            The Besties take turns with obstacle tricks. You can hit them
            whenever they are in range. Each little memory is a checkpoint: if
            your hearts run out, you return there with full health and
            everything you collected.
          </p>
          <p>
            Green hearts mark friends. Walk up for healing when you need it.
            Hurting them costs health; returning to make amends restores their
            help.
          </p>
          <dl>
            <dt>Keyboard</dt>
            <dd>
              WASD or arrows move. Space jumps. F attacks; Shift uses your
              secondary attack. Drag to look.
            </dd>
          </dl>
          <label className="volume-label">
            Sound volume
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={volume}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                soundRef.current?.setPreferences(muted, next);
              }}
            />
          </label>
          <button
            className="secondary sound-test"
            aria-describedby="sound-test-status"
            aria-busy={soundTest === "starting"}
            onClick={() => {
              const attemptId = ++soundTestAttempt.current;
              setSoundTest("starting");
              setMuted(false);
              soundRef.current?.setPreferences(false, volume || 0.8);
              if (!volume) setVolume(0.8);
              const attempt = soundRef.current?.audition();
              if (!attempt) setSoundTest("failed");
              else
                void attempt.then(
                  (ok) => {
                    if (
                      mounted.current &&
                      attemptId === soundTestAttempt.current
                    )
                      setSoundTest(ok ? "played" : "failed");
                  },
                  () => {
                    if (
                      mounted.current &&
                      attemptId === soundTestAttempt.current
                    )
                      setSoundTest("failed");
                  },
                );
            }}
          >
            Play a test sound
          </button>
          <p id="sound-test-status" className="sound-test-status" role="status">
            {soundTest === "starting"
              ? "Starting sound…"
              : soundTest === "played"
                ? "Sound test started. You can tap again to repeat it."
                : soundTest === "failed"
                  ? "Sound couldn’t start. Tap again to retry."
                  : "Tap to hear a memory chime."}
          </p>
          <p className="small-note">
            This private review uses fictional drawings. It has not connected to
            your photo library. Use the music-note button to mute the playtest
            sounds.
          </p>
          <button className="primary" onClick={() => setShowHelp(false)}>
            Back to the adventure
          </button>
        </Modal>
      )}

      {activeModal === "victory" && level && (
        <Modal
          notice={feedback}
          title="The memories are yours again."
          eyebrow={`${story.enemies.boss.toUpperCase()} · DEFEATED`}
          onClose={() => {
            setShowVictory(false);
            setPhotoDetail(null);
          }}
          wide
        >
          <p>
            Take a moment with each picture. Your traveler stays age{" "}
            {save.ageYears} until you absorb the whole bundle.
          </p>
          <div className="memory-grid">
            {bundle.map((memory) => (
              <MemoryCard key={memory.id} memory={memory}>
                {memory.state === "revealed" || memory.state === "consumed" ? (
                  <span className="remembered-mark">✓ Remembered</span>
                ) : (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      perform({
                        type: "recover-memory",
                        levelId: level.id,
                        memoryId: memory.id,
                      })
                    }
                  >
                    Remember this moment
                  </button>
                )}
              </MemoryCard>
            ))}
          </div>
          <button
            className="primary absorb-memories"
            disabled={!allRevealed || busy}
            onClick={() =>
              perform({ type: "consume-memory-bundle", levelId: level.id })
            }
          >
            {busy
              ? "Saving this moment…"
              : `Absorb memories · Grow to age ${level.targetAgeYears}`}
          </button>
          <small>
            {allRevealed
              ? level.index + 1 < level.totalLevels
                ? "A new period is waiting on the other side."
                : "These are the last memories selected for this journey."
              : "Remember every picture in this bundle to continue."}
          </small>
        </Modal>
      )}

      {activeModal === "photo" && activePhoto && (
        <Modal
          notice={feedback}
          title={activePhoto.label}
          eyebrow="A MEMORY RECLAIMED"
          onClose={() => setPhotoDetail(null)}
        >
          <MemoryCard memory={activePhoto} />
          <button className="primary" onClick={() => setPhotoDetail(null)}>
            Keep exploring
          </button>
        </Modal>
      )}
      {activeModal === "chapter" && (
        <Modal
          notice={feedback}
          title={`Welcome to ${level?.eraYear}.`}
          eyebrow={`AGE ${save.ageYears} · ${chapterTitle.toUpperCase()}`}
          onClose={() => setChapterNotice("")}
        >
          {chapterMemoryId && (
            <MemoryCard
              memory={save.memories.find(
                (memory) => memory.id === chapterMemoryId,
              )!}
            />
          )}
          <p>{chapterNotice}</p>
          {chapterSubtitle && <p>{chapterSubtitle}</p>}
          <p>{chapterDescription}</p>
          <button className="primary" onClick={() => setChapterNotice("")}>
            Enter the next era
          </button>
        </Modal>
      )}
      {activeModal === "fallen" &&
        level &&
        (recoveryBlocked ? (
          <Modal
            notice={feedback}
            title="Your adventure is safe"
            eyebrow="LET’S TRY AGAIN"
          >
            <p>We couldn’t return you to your checkpoint yet.</p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                setError("");
                setRecoveryBlocked(false);
                if (
                  !game.current?.performAction({
                    type: "retry-level",
                    levelId: level.id,
                  })
                ) {
                  blockRecovery();
                }
              }}
            >
              Return to checkpoint
            </button>
          </Modal>
        ) : (
          <div
            className="checkpoint-return"
            role="status"
            aria-label="Returning to your checkpoint"
            data-quest-ui
          >
            <span aria-hidden="true">♥</span>
          </div>
        ))}
      {activeModal === "album" && (
        <Modal
          notice={feedback}
          title="Your remembered world."
          eyebrow={`${visibleRecoveredCount} OF ${visibleMemories.length} MEMORIES`}
          onClose={() => setShowAlbum(false)}
          wide
        >
          <div className="memory-grid">
            {visibleMemories
              .filter((memory) => save.recoveredIds.includes(memory.id))
              .map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
          </div>
          {!visibleRecoveredCount && (
            <p>
              Look for two little memories along the path and a big memory after
              the boss.
            </p>
          )}
        </Modal>
      )}
      {activeModal === "complete" && (
        <Modal
          notice={feedback}
          title={selectedMemoryIds
            ? `${chapterTitles?.[chapterOnlyRouteId ?? ""] ?? "Chapter"} complete.`
            : "Every chapter, a little more you."}
          eyebrow={selectedMemoryIds ? "CHAPTER COMPLETE" : "JOURNEY COMPLETE"}
          wide
        >
          <p>
            {selectedMemoryIds
              ? `${visibleRecoveredCount} fictional memories reclaimed. Your traveler reached age ${save.ageYears}.`
              : `${view.completedLevelIds.length} eras faced. ${save.recoveredIds.length} memories reclaimed. Your traveler reached age ${save.ageYears}; this journey ends where its selected memories end.`}
          </p>
          <div className="memory-grid">
            {visibleMemories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
          <button className="primary" onClick={onLeave}>
            {leaveLabel ?? (ephemeral ? "Play again" : "Back to your journeys")}
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  notice,
  title,
  eyebrow,
  onClose,
  wide,
  children,
}: {
  notice?: React.ReactNode;
  title: string;
  eyebrow: string;
  onClose?: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="modal-scrim era-modal-scrim" data-quest-ui>
      <section
        ref={panel}
        tabIndex={-1}
        className={`game-modal era-modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "Escape" && onClose) {
            event.preventDefault();
            onClose();
          }
          if (event.key !== "Tab") return;
          const items = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]',
            ),
          ];
          const first = items[0],
            last = items.at(-1);
          if (!first) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {onClose && (
          <button className="close-modal" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {notice}
        {children}
      </section>
    </div>
  );
}

function ActionButton({
  action,
  label,
  symbol,
  disabled,
  active,
  input,
  cancelInput,
}: {
  action: GameInputAction;
  label: string;
  symbol: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  input: (action: GameInputAction, value: boolean) => void;
  cancelInput: (action: GameInputAction) => void;
}) {
  const control = useRef<HTMLButtonElement>(null);
  const pointer = useRef<number | undefined>(undefined);
  const pointerIsTouch = useRef(false);
  const touchIdentifier = useRef<number | undefined>(undefined);
  const pendingTouches = useRef(new Map<number, { x: number; y: number }>());
  const lastContact = useRef({ x: 0, y: 0 });
  const inputRef = useRef(input);
  const cancelInputRef = useRef(cancelInput);
  inputRef.current = input;
  cancelInputRef.current = cancelInput;
  const associateTouch = (clientX: number, clientY: number) => {
    if (touchIdentifier.current !== undefined) return;
    let closest: number | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const [identifier, contact] of pendingTouches.current) {
      const distance = Math.hypot(
        contact.x - clientX,
        contact.y - clientY,
      );
      if (distance < closestDistance) {
        closest = identifier;
        closestDistance = distance;
      }
    }
    touchIdentifier.current = closest;
  };
  const release = (cancelled: boolean) => {
    const activePointer = pointer.current;
    pointer.current = undefined;
    pointerIsTouch.current = false;
    touchIdentifier.current = undefined;
    pendingTouches.current.clear();
    if (activePointer !== undefined) {
      try {
        if (control.current?.hasPointerCapture?.(activePointer))
          control.current.releasePointerCapture(activePointer);
      } catch {
        // The browser may already have retired an interrupted pointer.
      }
    }
    if (cancelled) cancelInputRef.current(action);
    else inputRef.current(action, false);
  };
  useEffect(() => {
    const endPointer = (event: PointerEvent) => {
      if (event.pointerId === pointer.current) release(false);
    };
    const cancelPointer = (event: PointerEvent) => {
      if (event.pointerId === pointer.current) release(true);
    };
    const endTouch = (event: TouchEvent) => {
      let ownerEnded = false;
      for (let index = 0; index < event.changedTouches.length; index++) {
        const identifier = event.changedTouches[index]?.identifier;
        if (identifier === undefined) continue;
        pendingTouches.current.delete(identifier);
        if (identifier === touchIdentifier.current) ownerEnded = true;
      }
      if (ownerEnded) release(false);
    };
    const cancelTouch = (event: TouchEvent) => {
      let ownerCancelled = false;
      for (let index = 0; index < event.changedTouches.length; index++) {
        const identifier = event.changedTouches[index]?.identifier;
        if (identifier === undefined) continue;
        pendingTouches.current.delete(identifier);
        if (identifier === touchIdentifier.current) ownerCancelled = true;
      }
      if (ownerCancelled) release(true);
    };
    const interrupt = () => release(true);
    const visibility = () => {
      if (document.hidden) release(true);
    };
    window.addEventListener("pointerup", endPointer, true);
    window.addEventListener("pointercancel", cancelPointer, true);
    window.addEventListener("touchend", endTouch, true);
    window.addEventListener("touchcancel", cancelTouch, true);
    window.addEventListener("blur", interrupt);
    window.addEventListener("pagehide", interrupt);
    window.addEventListener("orientationchange", interrupt);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("freeze", interrupt);
    return () => {
      window.removeEventListener("pointerup", endPointer, true);
      window.removeEventListener("pointercancel", cancelPointer, true);
      window.removeEventListener("touchend", endTouch, true);
      window.removeEventListener("touchcancel", cancelTouch, true);
      window.removeEventListener("blur", interrupt);
      window.removeEventListener("pagehide", interrupt);
      window.removeEventListener("orientationchange", interrupt);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("freeze", interrupt);
      release(true);
    };
  }, [action]);
  return (
    <button
      ref={control}
      className={`action-button combat-${action} ${active ? "available" : ""}`}
      data-quest-pointer-action
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch" && event.button !== 0) return;
        if (pointer.current !== undefined) return;
        pointer.current = event.pointerId;
        pointerIsTouch.current = event.pointerType === "touch";
        lastContact.current = { x: event.clientX, y: event.clientY };
        if (pointerIsTouch.current)
          associateTouch(event.clientX, event.clientY);
        inputRef.current(action, true);
        // Queue the press before requesting capture. A browser-specific capture
        // failure must not turn a valid touch into a silent no-op.
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Window pointer/touch termination still releases the input.
        }
      }}
      onTouchStart={(event) => {
        for (let index = 0; index < event.changedTouches.length; index++) {
          const touch = event.changedTouches[index];
          if (touch)
            pendingTouches.current.set(touch.identifier, {
              x: touch.clientX,
              y: touch.clientY,
            });
        }
        if (pointer.current !== undefined && pointerIsTouch.current)
          associateTouch(lastContact.current.x, lastContact.current.y);
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId === pointer.current) release(false);
      }}
      onClick={(event) => {
        if (event.detail === 0) {
          input(action, true);
          queueMicrotask(() => input(action, false));
        }
      }}
    >
      <span aria-hidden="true">{symbol}</span>
      <small>{label}</small>
    </button>
  );
}

function Joystick({ game }: { game: React.RefObject<GameHandle | undefined> }) {
  const stick = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | undefined>(undefined);
  const pointerIsTouch = useRef(false);
  const touchIdentifier = useRef<number | undefined>(undefined);
  const pendingTouches = useRef(new Map<number, { x: number; y: number }>());
  const lastContact = useRef({ x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const travel = useRef(44);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const returnToNeutral = (renderKnob: boolean) => {
    if (renderKnob) setKnob({ x: 0, y: 0 });
    game.current?.setInput("moveX", 0);
    game.current?.setInput("moveY", 0);
  };
  const clear = (renderKnob = true) => {
    const activePointer = pointer.current;
    pointer.current = undefined;
    pointerIsTouch.current = false;
    touchIdentifier.current = undefined;
    pendingTouches.current.clear();
    if (activePointer !== undefined) {
      try {
        if (stick.current?.hasPointerCapture?.(activePointer))
          stick.current.releasePointerCapture(activePointer);
      } catch {
        // The browser may already have retired an interrupted pointer.
      }
    }
    returnToNeutral(renderKnob);
  };
  const associateTouch = (clientX: number, clientY: number) => {
    if (touchIdentifier.current !== undefined) return;
    let closest: number | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const [identifier, contact] of pendingTouches.current) {
      const distance = Math.hypot(
        contact.x - clientX,
        contact.y - clientY,
      );
      if (distance < closestDistance) {
        closest = identifier;
        closestDistance = distance;
      }
    }
    touchIdentifier.current = closest;
  };
  const measure = () => {
    const bounds = stick.current?.getBoundingClientRect();
    if (!bounds) return;
    travel.current = Math.max(16, bounds.width * 0.29);
    origin.current = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  };
  useEffect(() => {
    let landscape = window.innerWidth > window.innerHeight;
    const endPointer = (event: PointerEvent) => {
      if (event.pointerId === pointer.current) clear();
    };
    const endTouch = (event: TouchEvent) => {
      const activeTouch = touchIdentifier.current;
      let ownerEnded = false;
      for (let index = 0; index < event.changedTouches.length; index++) {
        const identifier = event.changedTouches[index]?.identifier;
        if (identifier === undefined) continue;
        pendingTouches.current.delete(identifier);
        if (identifier === activeTouch) ownerEnded = true;
      }
      if (ownerEnded) clear();
    };
    const movePointer = (event: PointerEvent) => {
      if (event.pointerId !== pointer.current) return;
      updateStick(event.clientX, event.clientY);
      event.preventDefault();
    };
    const leaveViewport = (event: PointerEvent) => {
      if (event.pointerId === pointer.current && event.relatedTarget === null)
        clear();
    };
    const interrupt = () => clear();
    const resize = () => {
      const nextLandscape = window.innerWidth > window.innerHeight;
      if (nextLandscape !== landscape) clear();
      else if (pointer.current !== undefined) {
        measure();
        updateStick(lastContact.current.x, lastContact.current.y);
      }
      landscape = nextLandscape;
    };
    window.addEventListener("blur", interrupt);
    window.addEventListener("pagehide", interrupt);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", interrupt);
    window.addEventListener("pointermove", movePointer, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointerup", endPointer, true);
    window.addEventListener("pointercancel", endPointer, true);
    window.addEventListener("pointerout", leaveViewport, true);
    window.addEventListener("touchend", endTouch, true);
    window.addEventListener("touchcancel", endTouch, true);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    const visibility = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("freeze", interrupt);
    return () => {
      window.removeEventListener("blur", interrupt);
      window.removeEventListener("pagehide", interrupt);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", interrupt);
      window.removeEventListener("pointermove", movePointer, true);
      window.removeEventListener("pointerup", endPointer, true);
      window.removeEventListener("pointercancel", endPointer, true);
      window.removeEventListener("pointerout", leaveViewport, true);
      window.removeEventListener("touchend", endTouch, true);
      window.removeEventListener("touchcancel", endTouch, true);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("freeze", interrupt);
      clear(false);
    };
  }, []);
  const updateStick = (clientX: number, clientY: number) => {
    lastContact.current = { x: clientX, y: clientY };
    const vector = getJoystickVector(
      origin.current.x,
      origin.current.y,
      clientX,
      clientY,
      travel.current,
    );
    const distance = vector.distance;
    const deadZone = 8 / travel.current;
    const strength =
      distance <= deadZone ? 0 : (distance - deadZone) / (1 - deadZone);
    setKnob({ x: vector.x * travel.current, y: -vector.y * travel.current });
    game.current?.setInput(
      "moveX",
      distance ? (vector.x / distance) * strength : 0,
    );
    game.current?.setInput(
      "moveY",
      distance ? (vector.y / distance) * strength : 0,
    );
  };
  return (
    <div
      className="joystick"
      ref={stick}
      role="group"
      aria-label="Touch movement control"
      data-testid="joystick"
      onPointerDown={(event) => {
        if (event.pointerType !== "touch" && event.button !== 0) return;
        if (pointer.current !== undefined) return;
        pointer.current = event.pointerId;
        pointerIsTouch.current = event.pointerType === "touch";
        if (pointerIsTouch.current)
          associateTouch(event.clientX, event.clientY);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* Release events still clear this finger. */
        }
        measure();
        updateStick(event.clientX, event.clientY);
      }}
      onTouchStart={(event) => {
        for (let index = 0; index < event.changedTouches.length; index++) {
          const touch = event.changedTouches[index];
          if (touch)
            pendingTouches.current.set(touch.identifier, {
              x: touch.clientX,
              y: touch.clientY,
            });
        }
        if (pointer.current !== undefined && pointerIsTouch.current)
          associateTouch(lastContact.current.x, lastContact.current.y);
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId === pointer.current) clear();
      }}
    >
      <i style={{ transform: `translate(${knob.x}px,${knob.y}px)` }} />
    </div>
  );
}
