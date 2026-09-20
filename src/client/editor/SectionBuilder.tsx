import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthoredLevelDocument } from "../../shared/authored-level";
import type { LevelEditorCommand } from "../../shared/editor-project";
import {
  LEVEL_EDITOR_SECTION_LIMITS,
  planLevelEditorSection,
  type LevelEditorSectionRequest,
} from "../../shared/editor-sections";
import { uniqueSectionPrefix } from "./editor-selection";
import { NumberField } from "./EditorFields";

type SectionOptions = Omit<
  Extract<LevelEditorCommand, { type: "section.add" }>,
  "type" | "chapterId" | "idPrefix"
>;

function defaultRejoin(
  document: AuthoredLevelDocument,
  platforms: readonly string[],
  fromPlatformId: string,
  options: Pick<
    LevelEditorSectionRequest,
    "pattern" | "side" | "steps" | "rise"
  > = { pattern: "arch", side: "left", steps: 4, rise: 0.3 },
): string {
  const later = platforms.slice(platforms.indexOf(fromPlatformId) + 1);
  // Prefer the opening-course span, then find a fitting alternative. A nearby
  // endpoint is not necessarily useful: a broad climb needs enough length.
  const candidates = [...later.slice(6), ...later.slice(0, 6)];
  const idPrefix = uniqueSectionPrefix(document, options.pattern);
  return (
    candidates.find(
      (toPlatformId) =>
        planLevelEditorSection(document, {
          ...options,
          idPrefix,
          fromPlatformId,
          toPlatformId,
        }).ok,
    ) ??
    later[0] ??
    ""
  );
}

export function SectionBuilder({
  document,
  selectedPlatformId,
  onBuild,
  onSelectStart,
}: {
  document: AuthoredLevelDocument;
  selectedPlatformId?: string;
  onBuild(options: SectionOptions): void;
  onSelectStart(id: string): void;
}) {
  const platforms = useMemo(
    () =>
      document.mainPath.filter((id) =>
        document.pieces.some(
          (piece) => piece.id === id && piece.type === "platform",
        ),
      ),
    [document],
  );
  const first =
    selectedPlatformId && platforms.slice(0, -1).includes(selectedPlatformId)
      ? selectedPlatformId
      : (platforms[0] ?? "");
  const [fromPlatformId, setFrom] = useState(first);
  const [toPlatformId, setTo] = useState(() =>
    defaultRejoin(document, platforms, first),
  );
  const [pattern, setPattern] = useState<"arch" | "zigzag">("arch");
  const [side, setSide] = useState<"left" | "right">("left");
  const [steps, setSteps] = useState(4);
  const [rise, setRise] = useState(0.3);
  const fromIndex = platforms.indexOf(fromPlatformId);
  const destinations = useMemo(
    () => platforms.slice(fromIndex + 1),
    [platforms, fromIndex],
  );

  useEffect(() => {
    if (!platforms.slice(0, -1).includes(fromPlatformId))
      setFrom(platforms[0] ?? "");
    if (!destinations.includes(toPlatformId)) {
      setTo(
        defaultRejoin(document, platforms, fromPlatformId, {
          pattern,
          side,
          steps,
          rise,
        }),
      );
    }
  }, [
    document,
    platforms,
    destinations,
    fromPlatformId,
    toPlatformId,
    pattern,
    side,
    steps,
    rise,
  ]);

  const previousSelection = useRef(selectedPlatformId);
  useEffect(() => {
    if (previousSelection.current === selectedPlatformId) return;
    previousSelection.current = selectedPlatformId;
    if (
      selectedPlatformId &&
      platforms.slice(0, -1).includes(selectedPlatformId)
    ) {
      setFrom(selectedPlatformId);
      setTo(
        defaultRejoin(document, platforms, selectedPlatformId, {
          pattern,
          side,
          steps,
          rise,
        }),
      );
    }
  }, [selectedPlatformId, document, platforms, pattern, side, steps, rise]);

  const preview = useMemo(
    () =>
      planLevelEditorSection(document, {
        idPrefix: uniqueSectionPrefix(document, pattern),
        fromPlatformId,
        toPlatformId,
        pattern,
        side,
        steps,
        rise,
      }),
    [document, fromPlatformId, toPlatformId, pattern, side, steps, rise],
  );

  const changeStart = (id: string) => {
    setFrom(id);
    onSelectStart(id);
    setTo(
      defaultRejoin(document, platforms, id, { pattern, side, steps, rise }),
    );
  };

  return (
    <section className="editor-section-builder" aria-label="Build a section">
      <h2>Build a section</h2>
      <p>
        Connect a climbing route beside the main course. Every platform stays
        editable.
      </p>
      <label className="editor-field">
        <span>Shape</span>
        <select
          value={pattern}
          onChange={(event) => setPattern(event.target.value as typeof pattern)}
        >
          <option value="arch">Raised arch</option>
          <option value="zigzag">Zigzag ridge</option>
        </select>
      </label>
      <label className="editor-field">
        <span>Start platform</span>
        <select
          value={fromPlatformId}
          onChange={(event) => changeStart(event.target.value)}
        >
          {platforms.slice(0, -1).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="editor-field">
        <span>Rejoin platform</span>
        <select
          value={toPlatformId}
          onChange={(event) => setTo(event.target.value)}
        >
          {destinations.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="editor-field">
        <span>Side</span>
        <select
          value={side}
          onChange={(event) => setSide(event.target.value as typeof side)}
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
      <div className="editor-field-grid">
        <NumberField
          label="Climbing steps"
          integer
          value={steps}
          onCommit={setSteps}
          min={2}
          max={LEVEL_EDITOR_SECTION_LIMITS.maxSteps}
          step={1}
        />
        <NumberField
          label="Rise per step"
          value={rise}
          onCommit={setRise}
          min={0.1}
          max={0.35}
          step={0.05}
        />
      </div>
      <p>
        Connections and safe checkpoints are added with the steps. Undo removes
        the whole section.
      </p>
      <p
        className={
          preview.ok ? "editor-section-preview" : "editor-section-warning"
        }
        role="status"
      >
        {preview.ok
          ? `${preview.plan.stepIds.length} platforms · top surface ${preview.plan.measurements.apexTop} units`
          : preview.issues[0]?.message}
      </p>
      <button
        className="editor-primary"
        disabled={
          !preview.ok ||
          fromIndex < 0 ||
          !toPlatformId ||
          !destinations.includes(toPlatformId)
        }
        onClick={() =>
          onBuild({ fromPlatformId, toPlatformId, pattern, side, steps, rise })
        }
      >
        Add section
      </button>
    </section>
  );
}
