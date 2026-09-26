import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  AdminDraftResponse,
  DraftChapterView,
  DraftSlotView,
  DraftView,
  FamilyPlayResponse,
  SuggestionView,
} from "../../shared/family-api";
import type { FamilyMemorySlot } from "../../shared/family-plan";
import { familyApi, familyErrorText } from "./family-client";

const POLL_MS = 2_000;

/**
 * The administrator's Memories screen (DESIGN-024 step 5): a card per chapter
 * with two little and one big photo slot, each with a private thumbnail, date,
 * age and caption. **Swap** shows suggestions for that slot's dates with
 * **Show more**; **Edit caption** fixes the text; **Publish** makes the journey
 * playable. Strings are `COPY:` placeholders.
 */
export function MemoriesScreen({
  childId,
  displayName,
  onBack,
  onPlay,
}: {
  childId: string;
  displayName: string;
  onBack: () => void;
  onPlay: (response: FamilyPlayResponse) => void;
}) {
  const [state, setState] = useState<AdminDraftResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const publishRequest = useRef<{ revision: number; id: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await familyApi.draft(childId));
    } catch (e) {
      setError(familyErrorText(e));
    }
  }, [childId]);
  useEffect(() => {
    void load();
  }, [load]);
  // Automatic picks run in the background; poll until they finish.
  useEffect(() => {
    if (!state?.picking) return;
    const timer = window.setTimeout(() => void load(), POLL_MS);
    return () => window.clearTimeout(timer);
  }, [state, load]);

  const draft = state?.draft ?? null;

  async function edit(run: (current: DraftView) => Promise<AdminDraftResponse>) {
    if (!draft) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setState(await run(draft));
      return true;
    } catch (e) {
      setError(familyErrorText(e));
      if (e instanceof Error && e.message === "DRAFT_CONFLICT") await load();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function pickAgain() {
    setBusy(true);
    setError("");
    try {
      setState(await familyApi.editDraft(childId, {
        op: "auto-pick",
        expectedRevision: draft?.revision ?? null,
        ...(draft ? { reseed: true } : {}),
      }));
    } catch (e) {
      setError(familyErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!draft) return;
    // One request id per draft revision, so a retried tap never publishes twice.
    if (publishRequest.current?.revision !== draft.revision) {
      publishRequest.current = { revision: draft.revision, id: crypto.randomUUID() };
    }
    setBusy(true);
    setError("");
    try {
      const published = await familyApi.publish(childId, draft.revision, publishRequest.current.id);
      // COPY: publish confirmation
      setNotice(`Published version ${published.revision}. The journey is ready to play.`);
    } catch (e) {
      setError(familyErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function startFresh() {
    // COPY: start-fresh confirmation
    if (!window.confirm("Start a new run with these photos? The current run's progress starts over.")) return;
    setBusy(true);
    setError("");
    try {
      onPlay(await familyApi.play(childId, true));
    } catch (e) {
      setError(familyErrorText(e));
      setBusy(false);
    }
  }

  return (
    <section className="family-memories">
      <button className="text-button" onClick={onBack}>
        {/* COPY: back to setup */}
        ← Back to setup
      </button>
      {/* COPY: memories heading */}
      <h1>{displayName ? `${displayName}'s memories` : "Memories"}</h1>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {state === null && !error && <p role="status">Loading…</p>}
      {state?.picking && <p role="status">Picking photos… this can take a minute.{/* COPY */}</p>}
      {state?.lastPickError && (
        <p role="alert">Picking photos didn't finish: {familyErrorText(new Error(state.lastPickError))}{/* COPY */}</p>
      )}
      {state && !state.picking && !draft && (
        <button className="primary" disabled={busy} onClick={() => void pickAgain()}>
          {/* COPY: first automatic pick */}
          Pick photos
        </button>
      )}
      {draft && !state?.picking && (
        <>
          <div className="family-chapters">
            {draft.chapters.map((chapter) => (
              <ChapterCard
                key={chapter.chapterId}
                childId={childId}
                chapter={chapter}
                busy={busy}
                onCaption={(slot, caption) => edit((current) => familyApi.editDraft(childId, {
                  op: "caption",
                  expectedRevision: current.revision,
                  chapterId: chapter.chapterId,
                  slot,
                  caption,
                }))}
                onSwap={(slot, token) => edit((current) => familyApi.editDraft(childId, {
                  op: "swap",
                  expectedRevision: current.revision,
                  chapterId: chapter.chapterId,
                  slot,
                  token,
                }))}
              />
            ))}
          </div>
          <div className="family-memories-actions">
            {!draft.publishable && (
              // COPY: publish blocked notice
              <p role="status">Every memory needs a photo before you can publish.</p>
            )}
            <button className="primary" disabled={busy || !draft.publishable} onClick={() => void publish()}>
              {/* COPY: publish button */}
              Publish
            </button>
            <button className="secondary" disabled={busy} onClick={() => void pickAgain()}>
              {/* COPY: re-run automatic picks */}
              Pick again
            </button>
            <button className="secondary" disabled={busy} onClick={() => void startFresh()}>
              {/* COPY: start a fresh run on the latest publication */}
              Start fresh with these photos
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function ChapterCard({
  childId,
  chapter,
  busy,
  onCaption,
  onSwap,
}: {
  childId: string;
  chapter: DraftChapterView;
  busy: boolean;
  onCaption: (slot: FamilyMemorySlot, caption: string) => Promise<boolean>;
  onSwap: (slot: FamilyMemorySlot, token: string) => Promise<boolean>;
}) {
  return (
    <article className="family-chapter-card">
      <header>
        <h2>{chapter.name}</h2>
        {/* COPY: chapter age band */}
        <span>Age {chapter.startAge} → {chapter.recoveredAge}</span>
      </header>
      <div className="family-slots">
        {chapter.slots.map((slot) => (
          <SlotCard
            key={slot.slot}
            childId={childId}
            chapterId={chapter.chapterId}
            slot={slot}
            busy={busy}
            onCaption={(caption) => onCaption(slot.slot, caption)}
            onSwap={(token) => onSwap(slot.slot, token)}
          />
        ))}
      </div>
    </article>
  );
}

function SlotCard({
  childId,
  chapterId,
  slot,
  busy,
  onCaption,
  onSwap,
}: {
  childId: string;
  chapterId: string;
  slot: DraftSlotView;
  busy: boolean;
  onCaption: (caption: string) => Promise<boolean>;
  onSwap: (token: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(slot.caption ?? "");
  const [swapping, setSwapping] = useState(false);
  useEffect(() => setCaption(slot.caption ?? ""), [slot.caption]);
  const big = slot.slot === "major";
  return (
    <div className={`family-slot ${big ? "is-big" : ""}`} data-slot={slot.slot}>
      {slot.thumbnailToken ? (
        <img
          className="family-thumbnail"
          src={familyApi.thumbnailUrl(slot.thumbnailToken)}
          alt={slot.caption ?? ""}
          loading="lazy"
        />
      ) : (
        // COPY: empty slot
        <div className="family-thumbnail is-empty">Needs a photo</div>
      )}
      {/* COPY: slot size label */}
      <small>{big ? "Big memory" : "Little memory"}</small>
      {slot.localDate && (
        // COPY: slot date and age
        <span className="family-slot-date">{slot.localDate} · Age {slot.ageYears}</span>
      )}
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onCaption(caption).then((saved) => saved && setEditing(false));
          }}
        >
          <input
            aria-label="Caption" // COPY: caption field label
            value={caption}
            maxLength={60}
            onChange={(event) => setCaption(event.target.value)}
          />
          <button className="secondary" disabled={busy}>Save{/* COPY */}</button>
        </form>
      ) : (
        slot.caption && <p className="family-caption">{slot.caption}</p>
      )}
      <div className="family-slot-actions">
        {slot.status === "filled" && !editing && (
          <button className="text-button" disabled={busy} onClick={() => setEditing(true)}>
            {/* COPY: edit caption */}
            Edit caption
          </button>
        )}
        <button className="text-button" disabled={busy} onClick={() => setSwapping((open) => !open)}>
          {/* COPY: swap / choose a photo */}
          {slot.status === "filled" ? "Swap" : "Choose a photo"}
        </button>
      </div>
      {swapping && (
        <Suggestions
          childId={childId}
          chapterId={chapterId}
          slot={slot.slot}
          busy={busy}
          onChoose={(token) => void onSwap(token).then((saved) => saved && setSwapping(false))}
        />
      )}
    </div>
  );
}

function Suggestions({
  childId,
  chapterId,
  slot,
  busy,
  onChoose,
}: {
  childId: string;
  chapterId: string;
  slot: FamilyMemorySlot;
  busy: boolean;
  onChoose: (token: string) => void;
}) {
  const [items, setItems] = useState<readonly SuggestionView[]>([]);
  const [cursor, setCursor] = useState<number | null>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const more = useCallback(async (next: number) => {
    setLoading(true);
    setError("");
    try {
      const page = await familyApi.suggestions(childId, chapterId, slot, next);
      setItems((current) => [...current, ...page.suggestions]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(familyErrorText(e));
    } finally {
      setLoading(false);
    }
  }, [childId, chapterId, slot]);
  useEffect(() => {
    void more(1);
  }, [more]);
  return (
    <div className="family-suggestions" role="group" aria-label="Suggestions">
      {error && <p role="alert">{error}</p>}
      {!loading && items.length === 0 && !error && <p>No other photos fit these dates.{/* COPY */}</p>}
      <div className="family-suggestion-grid">
        {items.map((item) => (
          <button key={item.token} className="family-suggestion" disabled={busy} onClick={() => onChoose(item.token)}>
            <img src={familyApi.thumbnailUrl(item.token)} alt="" loading="lazy" />
            {/* COPY: suggestion date and age */}
            <span>{item.localDate} · Age {item.ageYears}</span>
          </button>
        ))}
      </div>
      {cursor !== null && (
        <button className="secondary" disabled={loading} onClick={() => void more(cursor)}>
          {/* COPY: show more suggestions */}
          {loading ? "Loading…" : "Show more"}
        </button>
      )}
    </div>
  );
}
