import React, { useEffect, useRef, useState } from "react";
import type {
  GameplayAction,
  GameplayActionRequest,
  MemoryView,
  SaveView,
} from "../shared/contracts";
import { createGame } from "../game/index";
import { getJoystickVector } from "../game/input";
import type { GameHandle, GameStatus } from "../game/index";
import type { GameInputAction } from "../game/types";
import { api, friendlyError } from "./api";
import { QuestAudio } from "./audio";
import { MemoryImage } from "./MemoryImage";
import { equipmentName, eraStory } from "./era";

const friendlyNames: Record<string, string> = {
  blockling: "Blockling",
  "signal-moth": "Signal Moth",
  "buffer-baron": "Buffer Baron",
  "loop-dancer": "Loop Dancer",
  "prism-mimic": "Prism Mimic",
  trendweaver: "Trendweaver",
};
const bestiesInstructions: Record<string, string> = {
  "pink-warning": "Pink’s turn! Watch the foam sweeper.",
  "pink-trick": "Jump over the pink sweeper, or step aside!",
  "black-warning": "Black’s turn! Move off the glowing lane.",
  "black-trick": "Stay on the clear side, or jump!",
  "high-five": "A high-five… whoops!",
  dizzy: "They’re dizzy! Now use your wand!",
};

export function GameScreen({
  initialSave,
  onLeave,
  ephemeral = false,
}: {
  initialSave: SaveView;
  onLeave: () => void;
  ephemeral?: boolean;
}) {
  return initialSave.format === "legacy-v1" ? (
    <LegacyJourney save={initialSave} onLeave={onLeave} />
  ) : (
    <Adventure
      initialSave={initialSave}
      onLeave={onLeave}
      ephemeral={ephemeral}
    />
  );
}

function LegacyJourney({
  save,
  onLeave,
}: {
  save: SaveView;
  onLeave: () => void;
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
        Back to your journeys
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
}: {
  initialSave: SaveView;
  onLeave: () => void;
  ephemeral?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<GameHandle | undefined>(undefined);
  const [save, setSave] = useState(initialSave);
  const [status, setStatus] = useState<GameStatus>();
  const [error, setError] = useState("");
  const [attackNotice, setAttackNotice] = useState("");
  const [pickupMemoryId, setPickupMemoryId] = useState<string | null>(null);
  const [friendDialogId, setFriendDialogId] = useState<string | null>(null);
  const [confirmFriendlyHarm, setConfirmFriendlyHarm] = useState(false);
  const soundRef = useRef<QuestAudio | undefined>(undefined);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
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
  const victoryOpen = useRef(showVictory);
  victoryOpen.current = showVictory;
  const view = save.adventure!;
  const level = view.activeLevel;
  const routeMemories = Boolean(level?.majorMemoryId);
  const minorCount = save.memories.filter(
    (memory) =>
      level?.minorMemoryIds?.includes(memory.id) &&
      ["revealed", "consumed"].includes(memory.state ?? ""),
  ).length;
  const story = eraStory(level?.eraYear, level);
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
  const ordinaryLeft =
    level?.encounters.filter(
      (enemy) => enemy.role === "ordinary" && !enemy.defeated,
    ).length ?? 0;
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

  useEffect(() => {
    mounted.current = true;
    let previousRequestError: string | null = null;
    let previousAttackSequence = -1;
    let previouslyGrounded = true;
    let previousJumpSequence = 0;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const sound = new QuestAudio();
    soundRef.current = sound;
    setMuted(sound.preferences().muted);
    setVolume(sound.preferences().volume);
    const audioGesture = () => {
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
          const gear = next.adventure?.inventory.find(
            (item) => item.pickupId === action.pickupId,
          );
          setAttackNotice(
            `${equipmentName(gear)} ready${gear?.kind === "guard-tool" ? " · Bash for a second attack" : " · Attack to swing"}`,
          );
          if (noticeTimer) clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => {
            if (mounted.current) setAttackNotice("");
          }, 2300);
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
          const prior = before.adventure?.activeLevel?.friendlies?.find(
            (friend) => friend.id === action.friendlyId,
          );
          void sound.cue("ui-confirmed", { gain: 1, playbackRate: 1.1 });
          setAttackNotice(
            prior?.penaltyActive
              ? "Friends again!"
              : `A little kindness · +${(next.adventure?.playerHp ?? 0) - (before.adventure?.playerHp ?? 0)} health`,
          );
          if (noticeTimer) clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => {
            if (mounted.current) setAttackNotice("");
          }, 2200);
        }
        if (action?.type === "attack-friendly") {
          setConfirmFriendlyHarm(false);
          setFriendDialogId(null);
          const cost =
            (before.adventure?.playerHp ?? 0) - (next.adventure?.playerHp ?? 0);
          setAttackNotice(
            cost > 0
              ? `You hurt your friend · −${cost} health. Make amends to restore their help.`
              : "Your friend needs help. Make amends to restore the friendship.",
          );
          if (noticeTimer) clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => {
            if (mounted.current) setAttackNotice("");
          }, 2800);
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
      if (
        action?.type === "recover-memory" &&
        before.memories.find((memory) => memory.id === action.memoryId)
          ?.role === "minor" &&
        next.revision > before.revision
      ) {
        const memory = next.memories.find(
          (memory) => memory.id === action.memoryId,
        );
        setPickupMemoryId(action.memoryId);
        setAttackNotice(
          `Little memory found · ${memory?.label ?? "A moment remembered"}`,
        );
        if (noticeTimer) clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => {
          if (mounted.current) {
            setAttackNotice("");
            setPickupMemoryId(null);
          }
        }, 2300);
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
              const ranged =
                (latest.current.adventure?.inventory.find(
                  (item) => item.id === latest.current.adventure?.equippedId,
                )?.tier ?? 1) > 1;
              const messages = {
                accepted:
                  next.attackFeedback.kind === "secondary"
                    ? "Bash!"
                    : ranged
                      ? "Zap!"
                      : "Whack!",
                guarded:
                  "Wait for their missed high-five. Attack when they’re dizzy!",
                "no-target": "Move closer to a glowing enemy, then attack.",
                unarmed: "Walk into a glowing tool to pick it up.",
                cooldown: "Ready in a moment.",
                busy: "Your hit is landing…",
                unavailable: "You can attack during a fight.",
              };
              setAttackNotice(messages[outcome]);
              if (["accepted", "no-target", "guarded"].includes(outcome))
                void sound.feedback(
                  next.attackFeedback.kind === "secondary"
                    ? "secondary"
                    : "attack",
                );
              if (noticeTimer) clearTimeout(noticeTimer);
              noticeTimer = setTimeout(
                () => {
                  if (mounted.current) setAttackNotice("");
                },
                outcome === "accepted" ? 700 : 1800,
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
      if (noticeTimer) clearTimeout(noticeTimer);
      sound.dispose();
      soundRef.current = undefined;
      game.current?.dispose();
      game.current = undefined;
    };
  }, [initialSave]);

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
    // Celebration can play through its panel once gameplay has unlocked audio.
    // Only direct gestures attempt to unlock a suspended browser context.
    if (
      (activeModal === "chapter" || activeModal === "complete") &&
      soundRef.current?.status().contextState === "running"
    )
      void soundRef.current.audition("ability-unlocked");
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
  const bestiesInstruction = status?.bestiesPhase
    ? bestiesInstructions[status.bestiesPhase]
    : undefined;
  const objective =
    bestiesInstruction &&
    status?.bestiesPhase !== "inactive" &&
    view.phase === "exploring"
      ? bestiesInstruction
      : view.phase === "memory-released" && routeMemories
        ? minorCount < 2
          ? "Find the two little memories along the path, then visit the big memory."
          : "Walk into the big memory beyond the boss to grow older."
        : view.phase === "memory-released"
          ? allRevealed
            ? `Absorb the memories to grow to age ${level?.targetAgeYears}.`
            : "The boss has fallen. Reclaim the memories it held."
          : !weapon
            ? "Walk into the glowing mallet. Tap the world to jump!"
            : ordinaryLeft > 0
              ? `${ordinaryLeft} ${ordinaryLeft === 1 ? "goofy guest stands" : "goofy guests stand"} between you and the boss.`
              : `Face ${story.enemies.boss}. Watch its attack warning.`;
  const activePhoto = save.memories.find((memory) => memory.id === photoDetail);

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
          aria-label={ephemeral ? "Leave playtest" : "Save & leave"}
          disabled={busy || requestBusy.current}
          onClick={onLeave}
        >
          ← <span>{ephemeral ? "Leave playtest" : "Save & leave"}</span>
        </button>
        <div className="chapter-pill">
          <span>{level?.eraYear ?? "JOURNEY COMPLETE"}</span>
          <strong>{level ? story.title : "A life remembered"}</strong>
        </div>
        <div className="game-tools">
          <button
            className="glass-button"
            aria-label={muted ? "Enable sound" : "Mute sound"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              soundRef.current?.setPreferences(next);
              void soundRef.current?.start({ confirmation: true });
            }}
          >
            <span aria-hidden="true">{muted ? "♪̸" : "♪"}</span>
            <small>{muted ? "Sound off" : "Sound on"}</small>
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
            Little memories <b>{minorCount} / 2</b>
          </div>
        )}
        <div className="equipment-line">
          <span>✦ {equipmentName(weapon)}</span>
          {shield && <span>◈ {equipmentName(shield)}</span>}
        </div>
      </aside>
      <div
        className={`era-objective ${bestiesInstruction ? "besties" : ""} ${status?.bestiesPhase === "dizzy" ? "opening" : ""}`}
        aria-live="polite"
      >
        <small>
          CHAPTER {(level?.index ?? 0) + 1}
          {level ? ` OF ${level.totalLevels}` : ""}
        </small>
        <p>{objective}</p>
      </div>
      {boss && ordinaryLeft === 0 && view.phase === "exploring" && (
        <div className="boss-hud">
          <span>{story.enemies.boss}</span>
          <meter
            min={0}
            max={boss.maxHp}
            value={boss.hp}
            aria-label="Boss health"
          />
        </div>
      )}
      {target && !nearbyFriend && view.phase === "exploring" && (
        <div className="target-hint">
          {story.enemies[target.kind]} · {target.hp}/{target.maxHp}
        </div>
      )}
      {!modalOpen && feedback}
      {!modalOpen && attackNotice && (
        <div
          className="attack-notice"
          role="status"
          aria-live="polite"
          data-quest-ui
        >
          {pickupMemoryId && (
            <MemoryImage
              memory={save.memories.find(
                (memory) => memory.id === pickupMemoryId,
              )!}
            />
          )}
          {attackNotice}
        </div>
      )}
      {!modalOpen && (
        <div className="game-bottom" data-quest-ui>
          <Joystick game={game} />
          <div className="keyboard-hint">
            <span>WASD</span> move <span>SPACE</span> jump <span>F</span> attack{" "}
            <span>SHIFT</span> secondary
          </div>
          <div className="touch-jump-hint">
            Tap the world to jump · Drag to look
          </div>
          <div className="combat-actions">
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
      {nearbyFriend && !nearbyPickup && !attackNotice && !modalOpen && (
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
        Two-chapter playtest · Fictional memories · Candidate artwork
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
            Tap the world to jump, from your very first step. Use the left
            circle to move and drag the world to look around. Short gaps and
            padded sweepers lead to safe landing spots; a slip brings you back
            nearby.
          </p>
          <p>
            Attack hits a nearby enemy. Your second button, Bash, uses a shield
            for a stronger close-range hit. Step out of danger while it
            recharges. The Besties take turns with obstacle tricks: attack when
            their missed high-five leaves them dizzy.
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
            onClick={() => {
              setMuted(false);
              soundRef.current?.setPreferences(false, volume || 0.8);
              if (!volume) setVolume(0.8);
              void soundRef.current?.audition().then((ok) => {
                if (!ok)
                  setError(
                    "Sound couldn’t start. Check your device volume and tap Play a test sound again.",
                  );
              });
            }}
          >
            Play a test sound
          </button>
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
          eyebrow={`AGE ${save.ageYears} · ${story.title.toUpperCase()}`}
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
          <p>{story.description}</p>
          <button className="primary" onClick={() => setChapterNotice("")}>
            Enter the next era
          </button>
        </Modal>
      )}
      {activeModal === "fallen" && level && (
        <Modal
          notice={feedback}
          title="Take a breath. Try again."
          eyebrow="YOUR JOURNEY IS SAFE"
        >
          <p>
            You keep your equipment and collected memories for this attempt.
            Return with full health and another chance to face this era.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => perform({ type: "retry-level", levelId: level.id })}
          >
            Try this level again
          </button>
          <button className="secondary" disabled={busy} onClick={onLeave}>
            {ephemeral ? "Play again" : "Save & leave"}
          </button>
        </Modal>
      )}
      {activeModal === "album" && (
        <Modal
          notice={feedback}
          title="Your remembered world."
          eyebrow={`${save.recoveredIds.length} OF ${save.memories.length} MEMORIES`}
          onClose={() => setShowAlbum(false)}
          wide
        >
          <div className="memory-grid">
            {save.memories
              .filter((memory) => save.recoveredIds.includes(memory.id))
              .map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
          </div>
          {!save.recoveredIds.length && (
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
          title="Every chapter, a little more you."
          eyebrow="JOURNEY COMPLETE"
          wide
        >
          <p>
            {view.completedLevelIds.length} eras faced.{" "}
            {save.recoveredIds.length} memories reclaimed. Your traveler reached
            age {save.ageYears}; this journey ends where its selected memories
            end.
          </p>
          <div className="memory-grid">
            {save.memories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
          <button className="primary" onClick={onLeave}>
            {ephemeral ? "Play again" : "Back to your journeys"}
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
  symbol: string;
  disabled?: boolean;
  active?: boolean;
  input: (action: GameInputAction, value: boolean) => void;
  cancelInput: (action: GameInputAction) => void;
}) {
  return (
    <button
      className={`action-button combat-${action} ${active ? "available" : ""}`}
      data-quest-pointer-action
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        input(action, true);
        // Queue the press before requesting capture. A browser-specific capture
        // failure must not turn a valid touch into a silent no-op.
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // The pointer-up fallback below still releases the input.
        }
      }}
      onPointerUp={() => input(action, false)}
      onPointerCancel={() => cancelInput(action)}
      onLostPointerCapture={() => input(action, false)}
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
  const pointer = useRef<number | undefined>(undefined);
  const origin = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const clear = () => {
    pointer.current = undefined;
    setKnob({ x: 0, y: 0 });
    game.current?.setInput("moveX", 0);
    game.current?.setInput("moveY", 0);
  };
  useEffect(() => {
    window.addEventListener("blur", clear);
    const visibility = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
      game.current?.setInput("moveX", 0);
      game.current?.setInput("moveY", 0);
    };
  }, []);
  const updateStick = (clientX: number, clientY: number) => {
    const vector = getJoystickVector(
      origin.current.x,
      origin.current.y,
      clientX,
      clientY,
      44,
    );
    const distance = vector.distance;
    const strength =
      distance <= 8 / 44 ? 0 : (distance - 8 / 44) / (1 - 8 / 44);
    setKnob({ x: vector.x * 40, y: -vector.y * 40 });
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
      role="group"
      aria-label="Touch movement control"
      data-testid="joystick"
      onPointerDown={(event) => {
        if (pointer.current !== undefined) return;
        pointer.current = event.pointerId;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* Release events still clear this finger. */
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        origin.current = {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        };
        updateStick(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== pointer.current) return;
        updateStick(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (event.pointerId === pointer.current) clear();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointer.current) clear();
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId === pointer.current) clear();
      }}
    >
      <span className="stick-mark top">↑</span>
      <span className="stick-mark bottom">↓</span>
      <span className="stick-mark left">‹</span>
      <span className="stick-mark right">›</span>
      <i style={{ transform: `translate(${knob.x}px,${knob.y}px)` }} />
      <small>MOVE</small>
    </div>
  );
}
