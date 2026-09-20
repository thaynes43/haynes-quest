import { useEffect, useMemo, useState } from "react";
import type { AuthoredLevelDocument } from "../../shared/authored-level";
import type { LevelEditorCommand } from "../../shared/editor-project";
import { NumberField } from "./EditorFields";

type SectionOptions = Omit<
  Extract<LevelEditorCommand, { type: "section.add" }>,
  "type" | "chapterId" | "idPrefix"
>;

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
  const [toPlatformId, setTo] = useState(
    platforms[Math.min(platforms.indexOf(first) + 7, platforms.length - 1)] ??
      "",
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
      setTo(destinations[Math.min(6, destinations.length - 1)] ?? "");
    }
  }, [platforms, destinations, fromPlatformId, toPlatformId]);

  const changeStart = (id: string) => {
    setFrom(id);
    onSelectStart(id);
    const next = platforms.slice(platforms.indexOf(id) + 1);
    setTo(next[Math.min(6, next.length - 1)] ?? "");
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
          value={steps}
          onCommit={(value) => setSteps(Math.round(value))}
          min={2}
          max={6}
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
      <button
        className="editor-primary"
        disabled={
          fromIndex < 0 || !toPlatformId || !destinations.includes(toPlatformId)
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
