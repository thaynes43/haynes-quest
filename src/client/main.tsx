import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  PreviewResponse,
  SaveSummary,
  SaveView,
  SessionView,
} from "../shared/contracts";
import { GameScreen } from "./GameScreen";
import { MemoryImage } from "./MemoryImage";
import { api, friendlyError } from "./api";
import { installMultiTouchActivation } from "./touch-activation";
import "./styles.css";

const disposeMultiTouchActivation = installMultiTouchActivation(document);
import.meta.hot?.dispose(disposeMultiTouchActivation);

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
          Playtest · Two chapters · Fictional memories
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
                <span className="eyebrow">A LIFE WORTH FIGHTING FOR</span>
                <h1>
                  Every age.
                  <br />A new <em>adventure.</em>
                </h1>
                <p>
                  Explore the worlds you grew up in. Find useful gear, face the
                  pop culture of each era and defeat its boss. Then reclaim your
                  memories and grow into the next chapter.
                </p>
                <button
                  className="primary"
                  disabled={!session || busy}
                  onClick={() => setPage("setup")}
                >
                  Start a journey <Arrow />
                </button>
                <div className="welcome-note">
                  <span>01</span> Gear, goofy fights and gentle obstacles.
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
                  Equipment, battles and memories saved
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
                <b>01</b> Explore and find equipment
              </span>
              <i />
              <span>
                <b>02</b> Face the era’s boss
              </span>
              <i />
              <span>
                <b>03</b> Reclaim memories and grow
              </span>
            </div>
          </>
        )}
      </main>
      <footer>
        <span>Made for small adventures.</span>
        <span>Keyboard & mouse · Touch controls</span>
        <span>
          Your photos, family setup and more chapters are still to come.
        </span>
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
  const [limit, setLimit] = useState<number | "">(24);
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
        limit: limit === "" ? 24 : limit,
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
          title: "A life in chapters",
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
                required
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value === "" ? "" : Number(e.target.value));
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
                      This preview covers only the dates shown. More memories
                      may be available; choose a narrower date range to explore
                      later years.
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
                          <MemoryImage memory={m} />
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
createRoot(document.getElementById("root")!).render(<App />);
