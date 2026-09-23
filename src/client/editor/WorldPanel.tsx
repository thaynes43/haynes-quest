import { useState } from "react";
import type { AuthoredEncounterSlot } from "../../shared/authored-level";
import {
  LEVEL_EDITOR_PREPARED_ENEMIES,
  type LevelEditorChapterV2,
  type LevelEditorEncounterReference,
  type LevelEditorEnemyCandidate,
  type LevelEditorPreviewMemory,
  type LevelEditorProjectV2,
  type LevelEditorRecoveredAge,
  type LevelEditorRepresentedDateRange,
  type LevelEditorTemplateRouteId,
} from "../../shared/editor-project";
import {
  ALL_PARODY_CANDIDATES,
  PARODY_PERIODS,
  type ParodyPeriodId,
} from "../../shared/parody-catalog";
import { NumberField, TextAreaField, TextField } from "./EditorFields";

const encounterSlots: readonly AuthoredEncounterSlot[] = [
  "ordinary-1",
  "ordinary-2",
  "ordinary-3",
  "ordinary-4",
  "boss",
];

const themeNames = {
  garden: "Storybook garden",
  party: "Block party",
  arcade: "Midnight arcade · preview kit",
  toybox: "Skyline toybox · preview kit",
} as const;

type Theme = keyof typeof themeNames;

export interface WorldPanelProps {
  project: LevelEditorProjectV2;
  chapter: LevelEditorChapterV2;
  onSelectChapter(chapterId: string): void;
  onAddLevel(sourceTemplateId: LevelEditorTemplateRouteId): void;
  onDuplicateLevel(): void;
  onMoveLevel(direction: -1 | 1): void;
  onRemoveLevel(): void;
  onSetDetails(changes: Partial<Pick<LevelEditorChapterV2, "subtitle" | "description" | "representedDateRange" | "recoveredAge" | "previewMemories">>): void;
  onSetTheme(theme: Theme): void;
  onSetBirthDate(date: string): void;
  onAssignEncounter(slot: AuthoredEncounterSlot, reference: LevelEditorEncounterReference): void;
  onCreateCandidate(
    slot: AuthoredEncounterSlot,
    candidate: LevelEditorEnemyCandidate,
  ): boolean;
}

function visibleCatalogEntry(
  entry: (typeof LEVEL_EDITOR_PREPARED_ENEMIES)[number],
  chapter: LevelEditorChapterV2,
): boolean {
  const { startDate } = chapter.representedDateRange;
  return (
    entry.eligibleFrom <= startDate &&
    startDate <= entry.eligibleThrough &&
    entry.referenceAvailableBy <= startDate
  );
}

function selectedReferenceValue(reference: LevelEditorEncounterReference): string {
  return reference.source === "catalog"
    ? `catalog:${reference.catalogEntryId}`
    : `candidate:${reference.candidateId}`;
}

function encounterLabel(slot: AuthoredEncounterSlot): string {
  return slot === "boss" ? "Boss" : `Encounter ${slot.slice(-1)}`;
}

function suggestedCandidateId(name: string): string {
  const slug = name.toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 74).replace(/-$/g, "");
  return slug ? `enemy-${slug}` : "";
}

function currentPeriod(project: LevelEditorProjectV2, chapter: LevelEditorChapterV2): ParodyPeriodId {
  const boss = chapter.encounterSlots.boss;
  if (boss.source === "candidate") {
    const candidate = project.enemyCandidates.find((item) => item.id === boss.candidateId);
    if (candidate) return candidate.periodId;
  } else {
    const entry = LEVEL_EDITOR_PREPARED_ENEMIES.find((item) => item.id === boss.catalogEntryId);
    if (entry) return entry.periodId;
  }
  return "block-party-v1";
}

function CandidateForm({
  slot,
  expectedKind,
  periodId,
  dateRange,
  occupiedIds,
  onCancel,
  onCreate,
}: {
  slot: AuthoredEncounterSlot;
  expectedKind: "ordinary-a" | "ordinary-b" | "boss";
  periodId: ParodyPeriodId;
  dateRange: LevelEditorRepresentedDateRange;
  occupiedIds: ReadonlySet<string>;
  onCancel(): void;
  onCreate(candidate: LevelEditorEnemyCandidate): boolean;
}) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [idEdited, setIdEdited] = useState(false);
  const [reference, setReference] = useState("");
  const [visualJoke, setVisualJoke] = useState("");
  const [obstacle, setObstacle] = useState("");
  const [period, setPeriod] = useState(periodId);
  const kind = expectedKind;
  const [startDate, setStartDate] = useState(dateRange.startDate);
  const [endDate, setEndDate] = useState(dateRange.endDate);
  const role = slot === "boss" ? "boss" : "ordinary";

  return (
    <form
      className="editor-candidate-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (![id, name, reference, visualJoke, obstacle, startDate, endDate].every((value) => value.trim()) || occupiedIds.has(id)) return;
        onCreate({
          id,
          name: name.trim(),
          periodId: period,
          recognizableReference: reference.trim(),
          visualJoke: visualJoke.trim(),
          obstacleOrAttack: obstacle.trim(),
          eligibility: { startDate, endDate },
          role,
          kind,
          behaviorPreset: kind,
        });
      }}
    >
      <h3>New enemy for {encounterLabel(slot).toLowerCase()}</h3>
      <p>Describe the joke and the move. The playtest uses a neutral stand-in.</p>
      <label className="editor-field">
        <span>Name</span>
        <input required maxLength={80} value={name} onChange={(event) => {
          setName(event.target.value);
          if (!idEdited) setId(suggestedCandidateId(event.target.value));
        }} />
      </label>
      <label className="editor-field">
        <span>Stable ID</span>
        <input required maxLength={80} pattern="[a-z][a-z0-9-]*" value={id} aria-invalid={occupiedIds.has(id) || undefined} onChange={(event) => {
          setId(event.target.value);
          setIdEdited(true);
        }} />
      </label>
      <p className="editor-world-choice-state">This ID stays with the enemy in exports and later asset reviews. Use lowercase letters, numbers and hyphens.</p>
      {occupiedIds.has(id) && <p className="editor-world-choice-state" role="alert">This ID is already used. Choose another.</p>}
      <label className="editor-field">
        <span>Recognizable reference</span>
        <input required maxLength={240} value={reference} onChange={(event) => setReference(event.target.value)} />
      </label>
      <label className="editor-field">
        <span>Visual joke</span>
        <textarea required maxLength={240} rows={2} value={visualJoke} onChange={(event) => setVisualJoke(event.target.value)} />
      </label>
      <label className="editor-field">
        <span>Obstacle or attack</span>
        <textarea required maxLength={240} rows={2} value={obstacle} onChange={(event) => setObstacle(event.target.value)} />
      </label>
      <label className="editor-field">
        <span>Era group</span>
        <select value={period} onChange={(event) => setPeriod(event.target.value as ParodyPeriodId)}>
          {Object.entries(PARODY_PERIODS).map(([id, details]) => (
            <option key={id} value={id}>{details.title}</option>
          ))}
        </select>
      </label>
      {role === "ordinary" && (
        <div className="editor-readonly-field">
          <span>Move pattern</span>
          <strong>{kind === "ordinary-a" ? "Rush and retreat" : "Side step and feint"}</strong>
        </div>
      )}
      <div className="editor-field-grid">
        <label className="editor-field">
          <span>Eligible from</span>
          <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className="editor-field">
          <span>Eligible through</span>
          <input required type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
      </div>
      <div className="editor-inspector-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="editor-primary">Create candidate</button>
      </div>
    </form>
  );
}

export function WorldPanel({
  project,
  chapter,
  onSelectChapter,
  onAddLevel,
  onDuplicateLevel,
  onMoveLevel,
  onRemoveLevel,
  onSetDetails,
  onSetTheme,
  onSetBirthDate,
  onAssignEncounter,
  onCreateCandidate,
}: WorldPanelProps) {
  const [showMore, setShowMore] = useState(false);
  const [candidateSlot, setCandidateSlot] = useState<AuthoredEncounterSlot | null>(null);
  const selectedIndex = project.chapters.findIndex((item) => item.chapterId === chapter.chapterId);
  const periodId = currentPeriod(project, chapter);
  const occupiedIds = new Set([
    ...project.enemyCandidates.map((item) => item.id),
    ...ALL_PARODY_CANDIDATES.map((item) => item.id),
  ]);

  const setMemory = (slotId: LevelEditorPreviewMemory["slotId"], changes: Partial<LevelEditorPreviewMemory>) => {
    const memories = chapter.previewMemories.map((item) =>
      item.slotId === slotId ? { ...item, ...changes } : item,
    ) as unknown as LevelEditorChapterV2["previewMemories"];
    onSetDetails({ previewMemories: memories });
  };
  const setDateRange = (changes: Partial<LevelEditorRepresentedDateRange>) =>
    onSetDetails({ representedDateRange: { ...chapter.representedDateRange, ...changes } });
  const setAge = (changes: Partial<LevelEditorRecoveredAge>) =>
    onSetDetails({ recoveredAge: { ...chapter.recoveredAge, ...changes } });

  return (
    <div className="editor-world-panel">
      <section className="editor-world-section">
        <h2>Adventure levels</h2>
        <p>Each level has its own course, memories and cast. Your draft stays in this browser until you export it.</p>
        <ol className="editor-world-levels">
          {project.chapters.map((item, index) => (
            <li key={item.chapterId}>
              <button
                type="button"
                aria-current={item.chapterId === chapter.chapterId ? "step" : undefined}
                onClick={() => onSelectChapter(item.chapterId)}
              >
                <span>{index + 1}. {item.name}</span>
                <small>{themeNames[item.level.theme as Theme] ?? "World"}</small>
              </button>
            </li>
          ))}
        </ol>
        <div className="editor-world-actions">
          <button type="button" disabled={project.chapters.length >= 8} onClick={() => onAddLevel("garden-playground-v2")}>Add garden course</button>
          <button type="button" disabled={project.chapters.length >= 8} onClick={() => onAddLevel("besties-playground-v2")}>Add obby course</button>
          <button type="button" disabled={project.chapters.length >= 8} onClick={onDuplicateLevel}>Duplicate this level</button>
        </div>
        <div className="editor-world-order">
          <button type="button" disabled={selectedIndex <= 0} onClick={() => onMoveLevel(-1)}>Move earlier</button>
          <button type="button" disabled={selectedIndex >= project.chapters.length - 1} onClick={() => onMoveLevel(1)}>Move later</button>
          <button type="button" className="danger" disabled={project.chapters.length <= 1} onClick={onRemoveLevel}>Remove level</button>
        </div>
      </section>

      <section className="editor-world-section">
        <h2>Look and story</h2>
        <label className="editor-field">
          <span>World theme</span>
          <select value={chapter.level.theme} onChange={(event) => onSetTheme(event.target.value as Theme)}>
            {Object.entries(themeNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <TextField label="Short introduction" value={chapter.subtitle ?? ""} maxLength={100} onCommit={(subtitle) => onSetDetails({ subtitle })} />
        <TextAreaField label="What happens here?" value={chapter.description ?? ""} maxLength={240} onCommit={(description) => onSetDetails({ description })} />
        {(chapter.level.theme === "arcade" || chapter.level.theme === "toybox") &&
          <p className="editor-world-note">This theme has a preview kit while its final art is being reviewed.</p>}
      </section>

      <section className="editor-world-section">
        <h2>Fictional preview dates</h2>
        <p>These dates drive this private playtest. Family photos are unavailable in the editor.</p>
        <TextField label="Fictional birth date" value={project.fictionalBirthDate} maxLength={10} onCommit={onSetBirthDate} />
        <div className="editor-field-grid">
          <TextField label="Period starts" value={chapter.representedDateRange.startDate} maxLength={10} onCommit={(startDate) => setDateRange({ startDate })} />
          <TextField label="Period ends" value={chapter.representedDateRange.endDate} maxLength={10} onCommit={(endDate) => setDateRange({ endDate })} />
        </div>
        <div className="editor-field-grid">
          <NumberField label="Age from" value={chapter.recoveredAge.fromYears} min={0} max={120} integer step={1} onCommit={(fromYears) => setAge({ fromYears })} />
          <NumberField label="Age after boss" value={chapter.recoveredAge.toYears} min={0} max={120} integer step={1} onCommit={(toYears) => setAge({ toYears })} />
        </div>
        {chapter.previewMemories.map((memory) => (
          <fieldset className="editor-fieldset" key={memory.slotId}>
            <legend>{memory.slotId === "major" ? "Boss memory" : `Small memory ${memory.slotId === "minor-one" ? 1 : 2}`}</legend>
            <TextField label="Caption" value={memory.label} maxLength={160} onCommit={(label) => setMemory(memory.slotId, { label })} />
            <TextField label="Date" value={memory.date} maxLength={10} onCommit={(date) => setMemory(memory.slotId, { date })} />
          </fieldset>
        ))}
      </section>

      <section className="editor-world-section">
        <h2>Encounter cast</h2>
        <p>Prepared characters use their catalog art. New candidates use neutral placeholder art until their exact model is approved.</p>
        <button type="button" className="editor-world-show-more" aria-pressed={showMore} onClick={() => setShowMore((value) => !value)}>
          {showMore ? "Show date matches" : "Show more prepared characters"}
        </button>
        {encounterSlots.map((slot) => {
          const role = slot === "boss" ? "boss" : "ordinary";
          const kind = chapter.level.anchors.encounters[slot].kind;
          const selected = chapter.encounterSlots[slot];
          const selectedValue = selectedReferenceValue(selected);
          const prepared = LEVEL_EDITOR_PREPARED_ENEMIES.filter((entry) =>
            entry.role === role && entry.kind === kind &&
            (showMore || visibleCatalogEntry(entry, chapter)),
          );
          const candidates = project.enemyCandidates.filter((entry) =>
            entry.role === role && entry.kind === kind,
          );
          const choices = [
            ...prepared.map((entry) => ({ value: `catalog:${entry.id}`, label: `${entry.title} · ${PARODY_PERIODS[entry.periodId].title}` })),
            ...candidates.map((entry) => ({ value: `candidate:${entry.id}`, label: `${entry.name} · draft placeholder` })),
          ];
          if (!choices.some((entry) => entry.value === selectedValue)) {
            const selectedEntry = selected.source === "catalog"
              ? LEVEL_EDITOR_PREPARED_ENEMIES.find((entry) => entry.id === selected.catalogEntryId)
              : project.enemyCandidates.find((entry) => entry.id === selected.candidateId);
            choices.unshift({ value: selectedValue, label: `${selectedEntry && "title" in selectedEntry ? selectedEntry.title : selectedEntry?.name ?? "Missing character"} · current choice` });
          }
          return (
            <div className="editor-world-encounter" key={slot}>
              <label className="editor-field">
                <span>{encounterLabel(slot)}</span>
                <select
                  value={selectedValue}
                  onChange={(event) => {
                    const [source, id] = event.target.value.split(":");
                    if (!id) return;
                    onAssignEncounter(slot, source === "candidate"
                      ? { source: "candidate", candidateId: id }
                      : { source: "catalog", catalogEntryId: id, catalogEntryVersion: "v001" });
                  }}
                >
                  {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              </label>
              <p className="editor-world-choice-state">
                {selected.source === "candidate"
                  ? "Draft enemy · neutral art in this playtest · model review required"
                  : "Prepared model candidate · exact artwork review remains open"}
              </p>
              <button type="button" onClick={() => setCandidateSlot(slot)}>New candidate for this slot</button>
              {candidateSlot === slot && (
                <CandidateForm
                  key={`${chapter.chapterId}:${slot}`}
                  slot={slot}
                  expectedKind={chapter.level.anchors.encounters[slot].kind}
                  periodId={periodId}
                  dateRange={chapter.representedDateRange}
                  occupiedIds={occupiedIds}
                  onCancel={() => setCandidateSlot(null)}
                  onCreate={(candidate) => {
                    const created = onCreateCandidate(slot, candidate);
                    if (created) setCandidateSlot(null);
                    return created;
                  }}
                />
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
