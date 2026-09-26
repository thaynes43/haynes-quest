import React, { useCallback, useEffect, useState } from "react";
import type {
  AdminChildSummary,
  FamilyPlayResponse,
  PersonChoice,
  TemplateOffer,
} from "../../shared/family-api";
import { MemoriesScreen } from "./MemoriesScreen";
import { familyApi, familyErrorText } from "./family-client";

/**
 * Administrator setup (DESIGN-024 first run): the household's children, "Add
 * a child", and each child's Memories screen.
 */
export function FamilyAdmin({
  onBack,
  onPlay,
}: {
  onBack: () => void;
  onPlay: (response: FamilyPlayResponse) => void;
}) {
  const [children, setChildren] = useState<readonly AdminChildSummary[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setChildren((await familyApi.adminChildren()).children);
    } catch (e) {
      setError(familyErrorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (selected)
    return (
      <MemoriesScreen
        childId={selected}
        displayName={children?.find((entry) => entry.child.id === selected)?.child.displayName ?? ""}
        onBack={() => {
          setSelected(null);
          void load();
        }}
        onPlay={onPlay}
      />
    );
  if (adding)
    return (
      <AddChild
        onCancel={() => setAdding(false)}
        onCreated={(childId) => {
          setAdding(false);
          setSelected(childId);
          void load();
        }}
      />
    );
  return (
    <section className="family-admin">
      <button className="text-button" onClick={onBack}>
        ← Back to quests
      </button>
      <h1>Family setup</h1>
      {error && <p role="alert">{error}</p>}
      {children === null && !error && <p role="status">Loading…</p>}
      <ul className="family-children">
        {children?.map((entry) => (
          <li key={entry.child.id}>
            <button className="family-child-row" onClick={() => setSelected(entry.child.id)}>
              <strong>{entry.child.displayName}</strong>
              <span>
                {entry.picking
                  ? "Picking photos…"
                  : entry.draft
                    ? `${entry.draft.filled} of ${entry.draft.filled + entry.draft.needsPhoto} photos chosen`
                    : "No photos yet"}
                {entry.publication ? ` · Live (version ${entry.publication.revision})` : " · Not published yet"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={() => setAdding(true)}>
        Add a child
      </button>
    </section>
  );
}

function AddChild({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (childId: string) => void;
}) {
  const [immichName, setImmichName] = useState("");
  const [people, setPeople] = useState<readonly PersonChoice[] | null>(null);
  const [choice, setChoice] = useState<PersonChoice | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [templates, setTemplates] = useState<readonly TemplateOffer[] | null>(null);
  const [template, setTemplate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTemplates(null);
    setTemplate("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return;
    let live = true;
    void familyApi.templates(birthDate).then(
      (result) => {
        if (!live) return;
        setTemplates(result.templates);
        setTemplate(result.templates.length === 1 ? key(result.templates[0]!) : "");
      },
      (e: unknown) => live && setError(familyErrorText(e)),
    );
    return () => {
      live = false;
    };
  }, [birthDate]);

  function choose(person: PersonChoice) {
    setChoice(person);
    // The birthday comes from Immich's entered date; the admin confirms or corrects it.
    setBirthDate(person.birthDate ?? "");
  }

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setChoice(null);
    try {
      const result = (await familyApi.people(immichName)).people;
      setPeople(result);
      if (result.length === 1) choose(result[0]!);
    } catch (e) {
      setError(familyErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!choice) return;
    const [templateId, templateVersion] = template.split("@");
    setBusy(true);
    setError("");
    try {
      const child = await familyApi.createChild({
        immichName,
        personChoiceId: choice.id,
        displayName,
        birthDate,
        templateId: templateId ?? "",
        templateVersion: templateVersion ?? "",
      });
      // The game rebases the chapters and auto-picks every photo in the background.
      await familyApi.editDraft(child.id, { op: "auto-pick", expectedRevision: null });
      onCreated(child.id);
    } catch (e) {
      setError(familyErrorText(e));
      setBusy(false);
    }
  }

  return (
    <section className="family-add-child">
      <button className="text-button" onClick={onCancel}>
        ← Back
      </button>
      <h1>Add a child</h1>
      <form onSubmit={(event) => void lookup(event)}>
        <label>
          Their name in Immich
          <input value={immichName} onChange={(event) => setImmichName(event.target.value)} maxLength={120} required />
        </label>
        <button className="secondary" disabled={busy || !immichName.trim()}>
          Find
        </button>
      </form>
      {people?.length === 0 && <p role="status">No one in Immich has exactly that name.</p>}
      {people && people.length > 1 && (
        <fieldset className="family-person-choices">
          <legend>More than one person has that name. Choose the right one.</legend>
          {people.map((person, index) => (
            <label key={person.id}>
              <input
                type="radio"
                name="person"
                checked={choice?.id === person.id}
                onChange={() => choose(person)}
              />
              {person.label} · match {index + 1}
              {person.birthDate ? ` · born ${person.birthDate}` : " · no birthday saved"}
            </label>
          ))}
        </fieldset>
      )}
      {choice && (
        <form className="family-child-form" onSubmit={(event) => void create(event)}>
          <label>
            Name in the game
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} required />
          </label>
          <label>
            Birthday
            <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required />
          </label>
          {!choice.birthDate && <p className="small-note">Immich has no birthday for this person. Enter it here.</p>}
          {templates?.length === 0 && <p role="status">No quest world fits this birthday yet.</p>}
          {templates && templates.length > 0 && (
            <label>
              Quest world
              <select value={template} onChange={(event) => setTemplate(event.target.value)} required>
                <option value="">Choose a world</option>
                {templates.map((offer) => (
                  <option key={key(offer)} value={key(offer)}>
                    {offer.name} ({offer.chapterCount} chapters · {offer.version})
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="primary" disabled={busy || !template || !displayName.trim()}>
            {busy ? "Setting up…" : "Create quest and pick photos"}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function key(offer: TemplateOffer): string {
  return `${offer.id}@${offer.version}`;
}
