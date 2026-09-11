import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  PreviewResponse,
  SaveSummary,
  SaveView,
  SessionView,
} from "../shared/contracts";
import { createGame } from "../game/index";
import type { GameHandle, GameStatus } from "../game/index";
import { api, friendlyError } from "./api";
import { QuestAudio } from "./audio";
import "./styles.css";

function Sprout({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 27V13m0 6C6 20 3 13 4 7c7-1 12 3 12 10m0-3C16 6 22 3 28 4c1 7-3 13-12 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
function MemoryDrawing({ index = 0 }: { index?: number }) {
  return (
    <div className={`memory-drawing drawing-${index % 3}`}>
      <span className="paper-sun" />
      <span className="paper-hill hill-back" />
      <span className="paper-hill" />
      <Sprout />
      <small>Fictional memory</small>
    </div>
  );
}
function Brand() {
  return (
    <a className="brand" href="/" aria-label="Haynes Quest home">
      <span className="brand-seal">
        <Sprout />
      </span>
      <span>
        HAYNES <b>QUEST</b>
      </span>
    </a>
  );
}
const initialName = "Demo Adventurer";

function App() {
  const [session, setSession] = useState<SessionView>();
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [page, setPage] = useState<"home" | "setup" | "game">("home");
  const [save, setSave] = useState<SaveView>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const list = await api<{ saves: SaveSummary[] }>("/saves");
    setSaves(list.saves);
  }, []);
  useEffect(() => {
    let live = true;
    void api<SessionView>("/session")
      .then(async (s) => {
        if (live) setSession(s);
        await refresh();
      })
      .catch(() => {
        if (live)
          setError("The clearing is resting. Please try again in a moment.");
      });
    return () => {
      live = false;
    };
  }, [refresh]);
  async function resume(id: string) {
    setBusy(true);
    setError("");
    try {
      setSave(await api<SaveView>(`/saves/${id}`));
      setPage("game");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setPage("home");
    setSave(undefined);
    try {
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  if (page === "game" && save)
    return <GameScreen initialSave={save} onLeave={() => void leave()} />;
  return (
    <div className="app-shell">
      <header className="site-header">
        <Brand />
        <span className="preview-badge">
          <i />
          Private preview · Fictional memories
        </span>
        <a className="studio-link" href="/studio/assets/catalog.html">
          Asset studio <Arrow />
        </a>
      </header>
      <main>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}
        {page === "setup" ? (
          <Setup
            onBack={() => setPage("home")}
            onCreated={(s) => {
              setSave(s);
              setPage("game");
            }}
          />
        ) : (
          <>
            <section className="welcome">
              <div className="welcome-copy">
                <span className="eyebrow">EVERY MEMORY IS A BEGINNING</span>
                <h1>
                  A little journey
                  <br />
                  through <em>memories.</em>
                </h1>
                <p>
                  Follow a glowing path. Find the moments you’ve forgotten. Grow
                  a little with every discovery.
                </p>
                <button
                  className="primary"
                  disabled={!session || busy}
                  onClick={() => setPage("setup")}
                >
                  Start a journey <Arrow />
                </button>
                <div className="welcome-note">
                  <span>01</span> A clearing. Three memories. A little more you.
                </div>
              </div>
              <div
                className="storybook-window"
                aria-label="An abstract garden illustration for the private preview"
              >
                <div className="sky-disc" />
                <div className="cloud cloud-one" />
                <div className="cloud cloud-two" />
                <div className="illustrated-hill far" />
                <div className="illustrated-hill near" />
                <div className="illustrated-path" />
                <div className="illustrated-tree tree-one">
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
                <div className="illustrated-tree tree-two">
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
                <div className="illustrated-gate">
                  <i />
                  <b>✦</b>
                  <i />
                </div>
                <div className="illustrated-memory">✦</div>
                <div className="illustrated-traveler">
                  <i />
                  <b />
                </div>
                <span className="window-caption">THE FIRST CLEARING</span>
                <span className="window-star">✧</span>
              </div>
            </section>
            <section className="journeys">
              <div className="section-top">
                <div>
                  <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                  <h2>Your journeys</h2>
                </div>
                <span className="small-note">
                  Progress saved as you remember
                </span>
              </div>
              {saves.length ? (
                <div className="save-grid">
                  {saves.map((s, i) => (
                    <button
                      className="save-card"
                      key={s.id}
                      onClick={() => void resume(s.id)}
                      disabled={busy}
                    >
                      <MemoryDrawing index={i} />
                      <div>
                        <span className="save-subject">{s.subject.label}</span>
                        <h3>{s.title}</h3>
                        <p>
                          {s.recoveredCount} of {s.memoryCount} memories · Age{" "}
                          {s.ageYears}
                        </p>
                        <div className="save-bottom">
                          <span>
                            {s.completed ? "Journey complete" : "Continue"}
                          </span>
                          <Arrow />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-journey">
                  <span className="empty-icon">
                    <Sprout />
                  </span>
                  <div>
                    <h3>Your story is waiting.</h3>
                    <p>Start your first journey. We’ll keep your place here.</p>
                  </div>
                  <span className="empty-stars" aria-hidden="true">
                    ✦ · ✧
                  </span>
                </div>
              )}
            </section>
            <div className="how-it-feels">
              <span>
                <b>01</b> Find a memory
              </span>
              <i />
              <span>
                <b>02</b> Remember who you are
              </span>
              <i />
              <span>
                <b>03</b> Discover what you can do
              </span>
            </div>
          </>
        )}
      </main>
      <footer>
        <span>Made for small adventures.</span>
        <span>Keyboard & mouse · Touch controls</span>
        <span>Preview art and characters are temporary.</span>
      </footer>
    </div>
  );
}
function Setup({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (s: SaveView) => void;
}) {
  const [name, setName] = useState(initialName);
  const [birthDate, setBirthDate] = useState("2020-01-01");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [limit, setLimit] = useState(24);
  const [preview, setPreview] = useState<PreviewResponse>();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function discover(subjectId?: string) {
    setError("");
    setBusy(true);
    try {
      const result = await api<PreviewResponse>("/setup/preview", {
        name,
        birthDate,
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
        limit,
        ...(subjectId ? { subjectId } : {}),
      });
      setPreview(result);
      setSelected(result.selectedIds);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function begin() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await api<SaveView>("/saves", {
          previewId: preview.previewId,
          selectedIds: selected,
          title: "The first clearing",
        }),
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const changed = () => {
    setPreview(undefined);
    setSelected([]);
  };
  return (
    <section className="setup">
      <button className="text-button back" onClick={onBack}>
        ← Your journeys
      </button>
      <div className="setup-heading">
        <span className="eyebrow">A NEW BEGINNING</span>
        <h1>
          Whose memories
          <br />
          will you <em>follow?</em>
        </h1>
        <p>
          This preview follows Demo Adventurer, a fictional traveler with three
          illustrated memories.
        </p>
      </div>
      <div className="setup-grid">
        <form
          className="setup-form"
          onSubmit={(e) => {
            e.preventDefault();
            void discover();
          }}
        >
          <label>
            Traveler’s name
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                changed();
              }}
              required
              maxLength={120}
            />
          </label>
          <label>
            Birth date
            <input
              type="date"
              value={birthDate}
              onChange={(e) => {
                setBirthDate(e.target.value);
                changed();
              }}
              required
            />
            <small>Age comes from this date and each memory’s date.</small>
          </label>
          <details>
            <summary>Choose a date range</summary>
            <div className="date-range">
              <label>
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    changed();
                  }}
                />
              </label>
              <label>
                Through
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    changed();
                  }}
                />
              </label>
            </div>
            <label>
              Maximum memories
              <input
                type="number"
                min="1"
                max="24"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  changed();
                }}
              />
            </label>
          </details>
          <button className="primary" disabled={busy} type="submit">
            {busy ? "Finding memories…" : "Preview memories"}
            <Arrow />
          </button>
        </form>
        <div className="selection-area">
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {!preview ? (
            <div className="selection-empty">
              <Sprout />
              <h2>
                A few moments.
                <br />A whole little adventure.
              </h2>
              <p>
                Preview the available memories, then choose the ones to bring
                along.
              </p>
            </div>
          ) : (
            <>
              {preview.subjects.length > 1 && !preview.candidates.length ? (
                <div>
                  <h2>Choose your traveler</h2>
                  <p>More than one person has that name.</p>
                  {preview.subjects.map((s) => (
                    <button
                      key={s.id}
                      className="secondary"
                      onClick={() => void discover(s.id)}
                      disabled={busy}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="selection-top">
                    <h2>Your memories</h2>
                    <span>{selected.length} selected</span>
                  </div>
                  <p className="coverage">
                    {preview.coverage.fromDate?.slice(0, 4)} —{" "}
                    {preview.coverage.toDate?.slice(0, 4)} · In chronological
                    order
                  </p>
                  {preview.coverage.incomplete && (
                    <p className="inline-note">
                      This is a limited preview. More memories may be available.
                    </p>
                  )}
                  <div className="memory-grid">
                    {preview.candidates.map((m, i) => (
                      <label
                        className={`memory-choice ${selected.includes(m.id) ? "selected" : ""}`}
                        key={m.id}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(m.id)}
                          onChange={() =>
                            setSelected((ids) =>
                              ids.includes(m.id)
                                ? ids.filter((id) => id !== m.id)
                                : [...ids, m.id],
                            )
                          }
                        />
                        {m.mediaUrl ? (
                          <img src={m.mediaUrl} alt={m.label} />
                        ) : (
                          <MemoryDrawing index={i} />
                        )}
                        <span className="choice-check">
                          {selected.includes(m.id) ? "✓" : "+"}
                        </span>
                        <div>
                          <strong>{m.label}</strong>
                          <small>
                            {m.date} · Age {m.ageYears}
                          </small>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="selection-note">
                    These memories stay with this journey, even as the photo
                    library changes.
                  </p>
                  <button
                    className="primary"
                    disabled={!selected.length || busy}
                    onClick={() => void begin()}
                  >
                    {busy ? "Opening the clearing…" : "Begin your journey"}
                    <Arrow />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
function GameScreen({
  initialSave,
  onLeave,
}: {
  initialSave: SaveView;
  onLeave: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<GameHandle | undefined>(undefined);
  const audio = useRef<QuestAudio | undefined>(undefined);
  const [save, setSave] = useState(initialSave);
  const [status, setStatus] = useState<GameStatus>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Follow the glow to your next memory.");
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.45);
  const [showHelp, setShowHelp] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const mounted = useRef(true);
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  useEffect(() => {
    mounted.current = true;
    const sound = new QuestAudio();
    audio.current = sound;
    setMuted(sound.preferences().muted);
    setVolume(sound.preferences().volume);
    void sound.start();
    const update = (next: SaveView) => {
      if (mounted.current) setSave(next);
      return next;
    };
    if (!container.current) return;
    try {
      game.current = createGame({
        container: container.current,
        save: initialSave,
        onRecover: async (id) => {
          try {
            const next = await api<SaveView>(
              `/saves/${initialSave.id}/recover`,
              { memoryId: id },
            );
            if (mounted.current) {
              setError("");
              const index = next.memories.findIndex((m) => m.id === id);
              const before = index > 0 ? next.memories[index - 1].ageYears : 0;
              setNotice(
                next.ageYears >= 4 && before < 4
                  ? "You remembered how to jump."
                  : "A memory found. A little more of you.",
              );
              void sound.cue("memory-collected");
            }
            return update(next);
          } catch (e) {
            if (mounted.current) setError(friendlyError(e));
            throw e;
          }
        },
        onFinish: async () => {
          try {
            return update(
              await api<SaveView>(`/saves/${initialSave.id}/finish`, {}),
            );
          } catch (e) {
            if (mounted.current) setError(friendlyError(e));
            throw e;
          }
        },
        onStatus: (s) => {
          if (mounted.current) setStatus(s);
        },
      });
    } catch {
      setError(
        "This browser couldn’t open the 3D clearing. Try a browser with WebGL enabled.",
      );
    }
    const hidden = () => {
      if (document.hidden) {
        sound.suspend();
        game.current?.clearInput();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", hidden);
      game.current?.dispose();
      game.current = undefined;
      sound.dispose();
    };
  }, [initialSave]);
  useEffect(() => {
    game.current?.setPaused(showHelp || showAlbum || save.completed);
  }, [showHelp, showAlbum, save.completed]);
  const nextMemory = save.memories.find(
    (m) => !save.recoveredIds.includes(m.id),
  );
  const input = (action: "jump" | "interact", value: boolean) => {
    void audio.current?.start();
    game.current?.setInput(action, value);
  };
  return (
    <div className="game-screen">
      <div className="game-canvas" ref={container} />
      <div className="game-vignette" />
      <header className="game-header" data-quest-ui>
        <button
          className="glass-button leave-button"
          onClick={() => leaveRef.current()}
        >
          ← <span>Save & leave</span>
        </button>
        <div className="chapter-pill">
          <Sprout />
          <span>THE FIRST CLEARING</span>
        </div>
        <div className="game-tools">
          <button
            className="glass-button"
            aria-label={muted ? "Enable sound" : "Mute sound"}
            onClick={() => {
              const value = !muted;
              setMuted(value);
              audio.current?.setPreferences(value);
              void audio.current?.start();
            }}
          >
            {muted ? "♪̸" : "♪"}
          </button>
          <button
            className="glass-button"
            aria-label="How to play"
            onClick={() => setShowHelp((v) => !v)}
          >
            ?
          </button>
        </div>
      </header>
      <div className="journey-hud" data-quest-ui>
        <span className="eyebrow">{save.subject.label}</span>
        <div>
          <strong>Age {save.ageYears}</strong>
          <span>
            {save.appearance.stage === "infant"
              ? "A small beginning"
              : "Growing into yourself"}
          </span>
        </div>
        <button
          className="memory-counter"
          onClick={() => setShowAlbum(true)}
          aria-label="Open remembered memories"
        >
          <span>
            {save.memories.map((m) => (
              <i
                key={m.id}
                className={save.recoveredIds.includes(m.id) ? "filled" : ""}
              />
            ))}
          </span>
          <small>
            {save.recoveredIds.length} / {save.memories.length} memories
          </small>
        </button>
      </div>
      <div className="objective-pill" aria-live="polite">
        {save.completed
          ? "Journey complete"
          : nextMemory
            ? `Find memory ${save.recoveredIds.length + 1} · ${nextMemory.date.slice(0, 4)}`
            : "Follow the path to the lantern"}
      </div>
      <div className="game-notice" role="status">
        {notice}
      </div>
      {error && (
        <div className="game-error" role="alert" data-quest-ui>
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      <div className="game-bottom" data-quest-ui>
        <Joystick game={game} onStart={() => void audio.current?.start()} />
        <div className="keyboard-hint">
          <span>W A S D</span> move <span>DRAG</span> look <span>E</span>{" "}
          remember{" "}
          {save.abilities.includes("jump") && (
            <>
              <span>SPACE</span> jump
            </>
          )}
        </div>
        <div className="action-buttons">
          <button
            className="action-button jump"
            aria-label="Jump"
            disabled={!save.abilities.includes("jump") || save.completed}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              input("jump", true);
            }}
            onPointerUp={() => input("jump", false)}
            onPointerCancel={() => input("jump", false)}
            onLostPointerCapture={() => input("jump", false)}
          >
            ↑
            <small>
              {save.abilities.includes("jump") ? "Jump" : "Still learning"}
            </small>
          </button>
          <button
            className={`action-button remember ${status?.nearMemoryId || status?.nearFinish ? "available" : ""}`}
            disabled={
              (!status?.nearMemoryId && !status?.nearFinish) ||
              status?.recovering ||
              save.completed
            }
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              input("interact", true);
            }}
            onPointerUp={() => input("interact", false)}
            onPointerCancel={() => input("interact", false)}
            onLostPointerCapture={() => input("interact", false)}
            onClick={(e) => {
              if (e.detail === 0) {
                input("interact", true);
                setTimeout(() => input("interact", false), 80);
              }
            }}
          >
            <Sprout />
            <small>
              {status?.nearFinish ? "Complete journey" : "Remember"}
            </small>
          </button>
        </div>
      </div>
      <div className="placeholder-label" data-quest-ui>
        Private preview · Temporary art · Fictional memories
      </div>
      {showHelp && (
        <div className="modal-scrim" data-quest-ui>
          <section
            className="game-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              className="close-modal"
              onClick={() => setShowHelp(false)}
              aria-label="Close help"
            >
              ×
            </button>
            <span className="eyebrow">A LITTLE GUIDANCE</span>
            <h2 id="help-title">Follow the glow.</h2>
            <p>
              Move close to the next golden memory and choose Remember. Each
              memory brings back a little of who you are.
            </p>
            <dl>
              <dt>On a touchscreen</dt>
              <dd>
                Move with the left circle. Drag the open scene to look around.
                Use the buttons on the right to remember and jump.
              </dd>
              <dt>With a keyboard & mouse</dt>
              <dd>
                WASD or arrow keys move. Drag to look. E remembers. Space jumps
                once you’ve learned how.
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
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  audio.current?.setPreferences(muted, Number(e.target.value));
                }}
              />
            </label>
            <small>
              Sound candidates are waiting in the asset studio. This preview
              plays quietly.
            </small>
            <button className="primary" onClick={() => setShowHelp(false)}>
              Back to the clearing <Arrow />
            </button>
          </section>
        </div>
      )}
      {showAlbum && (
        <div className="modal-scrim" data-quest-ui>
          <section
            className="game-modal album"
            role="dialog"
            aria-modal="true"
            aria-labelledby="album-title"
          >
            <button
              className="close-modal"
              onClick={() => setShowAlbum(false)}
              aria-label="Close memories"
            >
              ×
            </button>
            <span className="eyebrow">MOMENTS YOU’VE FOUND</span>
            <h2 id="album-title">Your remembered world.</h2>
            <div className="memory-grid">
              {save.memories
                .filter((m) => save.recoveredIds.includes(m.id))
                .map((m) => (
                  <figure key={m.id}>
                    <img src={m.mediaUrl} alt={m.label} />
                    <figcaption>
                      {m.label}
                      <small>
                        {m.date} · Age {m.ageYears}
                      </small>
                    </figcaption>
                  </figure>
                ))}
            </div>
            {!save.recoveredIds.length && (
              <p>Your first memory is waiting along the path.</p>
            )}
            <button className="primary" onClick={() => setShowAlbum(false)}>
              Keep exploring <Arrow />
            </button>
          </section>
        </div>
      )}
      {save.completed && (
        <div className="modal-scrim finish-scrim" data-quest-ui>
          <section
            className="game-modal completion"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-title"
          >
            <span className="finish-seal">
              <Sprout />
            </span>
            <span className="eyebrow">THE FIRST CLEARING · COMPLETE</span>
            <h1 id="finish-title">
              A little more of you,
              <br />
              <em>remembered.</em>
            </h1>
            <p>
              {save.recoveredIds.length} memories found. Your traveler reached
              age {save.ageYears}.
            </p>
            <div className="finish-memories">
              {save.memories.map((m) => (
                <img key={m.id} src={m.mediaUrl} alt={m.label} />
              ))}
            </div>
            <button className="primary" onClick={() => leaveRef.current()}>
              Back to your journeys <Arrow />
            </button>
            <small>Your journey is saved.</small>
          </section>
        </div>
      )}
    </div>
  );
}
function Joystick({
  game,
  onStart,
}: {
  game: React.RefObject<GameHandle | undefined>;
  onStart: () => void;
}) {
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
    };
  }, []);
  return (
    <div
      className="joystick"
      role="group"
      aria-label="Touch movement control"
      data-testid="joystick"
      onPointerDown={(e) => {
        if (pointer.current !== undefined) return;
        onStart();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const b = e.currentTarget.getBoundingClientRect();
        origin.current = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pointer.current) return;
        const x = e.clientX - origin.current.x,
          y = e.clientY - origin.current.y;
        const r = Math.max(1, Math.hypot(x, y) / 36);
        const dx = x / r,
          dy = y / r;
        setKnob({ x: dx, y: dy });
        game.current?.setInput("moveX", dx / 36);
        game.current?.setInput("moveY", -dy / 36);
      }}
      onPointerUp={(e) => {
        if (e.pointerId === pointer.current) clear();
      }}
      onPointerCancel={(e) => {
        if (e.pointerId === pointer.current) clear();
      }}
      onLostPointerCapture={(e) => {
        if (e.pointerId === pointer.current) clear();
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

createRoot(document.getElementById("root")!).render(<App />);
