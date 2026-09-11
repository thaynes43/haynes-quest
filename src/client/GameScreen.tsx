import React, { useEffect, useRef, useState } from "react";
import type {
  GameplayAction,
  GameplayActionRequest,
  MemoryView,
  SaveView,
} from "../shared/contracts";
import { createGame } from "../game/index";
import type { GameHandle, GameStatus } from "../game/index";
import type { GameInputAction } from "../game/types";
import { api, friendlyError } from "./api";
import { QuestAudio } from "./audio";
import { MemoryImage } from "./MemoryImage";
import { equipmentName, eraStory } from "./era";

export function GameScreen({
  initialSave,
  onLeave,
}: {
  initialSave: SaveView;
  onLeave: () => void;
}) {
  return initialSave.format === "legacy-v1" ? (
    <LegacyJourney save={initialSave} onLeave={onLeave} />
  ) : (
    <Adventure initialSave={initialSave} onLeave={onLeave} />
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
}: {
  initialSave: SaveView;
  onLeave: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<GameHandle | undefined>(undefined);
  const [save, setSave] = useState(initialSave);
  const [status, setStatus] = useState<GameStatus>();
  const [error, setError] = useState("");
  const soundRef = useRef<QuestAudio | undefined>(undefined);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.45);
  const [showHelp, setShowHelp] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [showVictory, setShowVictory] = useState(
    initialSave.adventure?.phase === "memory-released",
  );
  const [chapterNotice, setChapterNotice] = useState("");
  const [photoDetail, setPhotoDetail] = useState<string | null>(null);
  const mounted = useRef(true);
  const latest = useRef(initialSave);
  const requestBusy = useRef(false);
  const victoryOpen = useRef(showVictory);
  victoryOpen.current = showVictory;
  const view = save.adventure!;
  const level = view.activeLevel;
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
  const target = level?.encounters.find(
    (enemy) => enemy.id === status?.nearEncounterId,
  );

  useEffect(() => {
    mounted.current = true;
    let previousRequestError: string | null = null;
    const sound = new QuestAudio();
    soundRef.current = sound;
    setMuted(sound.preferences().muted);
    setVolume(sound.preferences().volume);
    const audioGesture = () => {
      void sound.start();
    };
    const audioVisibility = () => {
      if (document.hidden) sound.suspend();
    };
    document.addEventListener("pointerdown", audioGesture);
    document.addEventListener("keydown", audioGesture);
    document.addEventListener("visibilitychange", audioVisibility);
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
      if (action?.type === "recover-memory") void sound.cue("memory-collected");
      if (action?.type === "consume-memory-bundle")
        void sound.cue("ability-unlocked");
      if (
        action?.type === "recover-memory" &&
        before.adventure?.phase === "memory-released" &&
        !victoryOpen.current
      )
        setPhotoDetail(action.memoryId);
      if (
        action?.type === "consume-memory-bundle" &&
        next.ageYears !== before.ageYears
      ) {
        setShowVictory(false);
        setPhotoDetail(null);
        if (!next.completed)
          setChapterNotice(
            `Age ${next.ageYears}. A new chapter begins in ${next.adventure?.activeLevel?.eraYear}. ${!before.abilities.includes("jump") && next.abilities.includes("jump") ? "You can now jump. " : ""}Your equipment and earlier abilities stay with you.`,
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
          onAction: act,
          onRefresh: async () =>
            update(await api<SaveView>(`/saves/${initialSave.id}`)),
          onStatus: (next) => {
            if (!mounted.current) return;
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
      document.removeEventListener("pointerdown", audioGesture);
      document.removeEventListener("keydown", audioGesture);
      document.removeEventListener("visibilitychange", audioVisibility);
      sound.dispose();
      soundRef.current = undefined;
      game.current?.dispose();
      game.current = undefined;
    };
  }, [initialSave]);

  const activeModal = status?.mediaReloadRequired
    ? "artwork-update"
    : save.completed
      ? "complete"
      : view.phase === "fallen"
        ? "fallen"
        : showVictory && level && view.phase === "memory-released"
          ? "victory"
          : chapterNotice
            ? "chapter"
            : photoDetail
              ? "photo"
              : showHelp
                ? "help"
                : showAlbum
                  ? "album"
                  : null;
  const modalOpen = activeModal !== null;
  useEffect(() => {
    game.current?.setPaused(modalOpen);
  }, [modalOpen]);

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
      {Boolean(status?.mediaFailed) && !status?.mediaReloadRequired && (
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
    game.current?.performAction(action);
  };
  const busy = status?.requestBusy ?? false;
  const actionInput = (action: GameInputAction, value: boolean) =>
    game.current?.setInput(action, value);
  const objective =
    view.phase === "memory-released"
      ? allRevealed
        ? `Absorb the memories to grow to age ${level?.targetAgeYears}.`
        : "The boss has fallen. Reclaim the memories it held."
      : !weapon
        ? "Find the spark mallet, then follow the course to the party."
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
          aria-label="Save & leave"
          disabled={busy || requestBusy.current}
          onClick={onLeave}
        >
          ← <span>Save & leave</span>
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
              void soundRef.current?.start();
            }}
          >
            {muted ? "♪̸" : "♪"}
          </button>
          <button
            className="glass-button"
            aria-label="Open your memories"
            onClick={() => setShowAlbum(true)}
          >
            ▧
          </button>
          <button
            className="glass-button"
            aria-label="How to play"
            onClick={() => setShowHelp(true)}
          >
            ?
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
        <div className="equipment-line">
          <span>✦ {equipmentName(weapon)}</span>
          {shield && <span>◈ {equipmentName(shield)}</span>}
        </div>
      </aside>
      <div className="era-objective" aria-live="polite">
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
      {target && view.phase === "exploring" && (
        <div className="target-hint">
          {story.enemies[target.kind]} · {target.hp}/{target.maxHp}
        </div>
      )}
      {!modalOpen && feedback}
      {!modalOpen && (
        <div className="game-bottom" data-quest-ui>
          <Joystick game={game} />
          <div className="keyboard-hint">
            <span>WASD</span> move <span>DRAG</span> look <span>F</span> attack{" "}
            <span>SHIFT</span> guard <span>E</span> use{" "}
            {save.abilities.includes("jump") && (
              <>
                <span>SPACE</span> jump
              </>
            )}
          </div>
          <div className="combat-actions">
            <ActionButton
              action="guard"
              label="Guard"
              symbol="◈"
              disabled={!shield || view.phase !== "exploring"}
              active={status?.guardActive}
              input={actionInput}
            />
            <ActionButton
              action="jump"
              label="Jump"
              symbol="↑"
              disabled={
                !save.abilities.includes("jump") ||
                (view.phase !== "exploring" && view.phase !== "memory-released")
              }
              input={actionInput}
            />
            <ActionButton
              action="attack"
              label="Attack"
              symbol="✦"
              disabled={!weapon || view.phase !== "exploring"}
              active={Boolean(target && status?.attackReady)}
              input={actionInput}
            />
            <ActionButton
              action="interact"
              label={nearbyPickup ? "Take gear" : "Remember"}
              symbol={nearbyPickup ? "+" : "▧"}
              disabled={!status?.nearPickupId && !status?.nearMemoryId}
              active={Boolean(status?.nearPickupId || status?.nearMemoryId)}
              input={actionInput}
            />
          </div>
        </div>
      )}
      {nearbyPickup && !modalOpen && (
        <div className="pickup-prompt" data-quest-ui>
          <strong>{equipmentName(nearbyPickup)}</strong>
          <span>
            {nearbyPickup.kind === "attack-tool"
              ? `${nearbyPickup.damage} strength · equips when collected`
              : "Soften incoming hits with a well-timed guard"}
          </span>
        </div>
      )}
      {view.phase === "memory-released" && !modalOpen && (
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

      {activeModal === "artwork-update" && (
        <Modal title="Let’s reopen this journey." eyebrow="ARTWORK UPDATE">
          <p>
            A newer set of artwork is needed to continue. Your saved progress is
            safe.
          </p>
          <button className="primary" onClick={() => window.location.reload()}>
            Reload journey
          </button>
          <button className="secondary" onClick={onLeave}>
            Save &amp; leave
          </button>
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
            Find tools and shields, dodge the silly guests and beat the boss.
            Step out of a red attack circle, or guard with your shield.
          </p>
          <p>
            After the boss falls, remember the pictures it releases. Absorb that
            bundle to grow older and enter the next period. Your gear and
            learned abilities stay with you.
          </p>
          <p>
            Take your time with the obstacles. Watch a padded sweeper pass, then
            walk around it. When you learn to jump, hop over the short gaps and
            ride the yellow platform. Glowing landing strips mark safe places: a
            slip brings you back nearby with your gear and victories.
          </p>
          <dl>
            <dt>Touch</dt>
            <dd>
              Move with the left circle. Drag the scene to look. Attack, guard
              and use equipment with the buttons on the right.
            </dd>
            <dt>Keyboard</dt>
            <dd>
              WASD or arrows move. Drag to look. F attacks, Shift guards, E
              picks up gear or remembers. Space jumps from age four onward.
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
          <p className="small-note">
            This private review uses fictional drawings. It has not connected to
            your photo library. Sound is still awaiting review.
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
            Your equipment and earlier memories are saved. Return with full
            health and another chance to face this era.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => perform({ type: "retry-level", levelId: level.id })}
          >
            Try this level again
          </button>
          <button className="secondary" disabled={busy} onClick={onLeave}>
            Save & leave
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
              Your first pictures will be released after you defeat the boss.
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
            Back to your journeys
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
}: {
  action: GameInputAction;
  label: string;
  symbol: string;
  disabled?: boolean;
  active?: boolean;
  input: (action: GameInputAction, value: boolean) => void;
}) {
  return (
    <button
      className={`action-button combat-${action} ${active ? "available" : ""}`}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        input(action, true);
      }}
      onPointerUp={() => input(action, false)}
      onPointerCancel={() => input(action, false)}
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
  return (
    <div
      className="joystick"
      role="group"
      aria-label="Touch movement control"
      data-testid="joystick"
      onPointerDown={(event) => {
        if (pointer.current !== undefined) return;
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        const bounds = event.currentTarget.getBoundingClientRect();
        origin.current = {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        };
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== pointer.current) return;
        const x = event.clientX - origin.current.x,
          y = event.clientY - origin.current.y;
        const scale = Math.max(1, Math.hypot(x, y) / 36);
        setKnob({ x: x / scale, y: y / scale });
        game.current?.setInput("moveX", x / scale / 36);
        game.current?.setInput("moveY", -y / scale / 36);
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
