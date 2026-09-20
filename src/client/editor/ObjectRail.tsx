import { useMemo, useState, type ReactNode } from "react";
import type { AuthoredLevelDocument } from "../../shared/authored-level";
import {
  objectRows,
  selectionKey,
  type EditorSelection,
} from "./editor-selection";

const GROUPS = ["Platforms", "Hazards", "Checkpoints", "Gameplay"] as const;

export function ObjectRail({
  document,
  selection,
  onSelect,
  onAdd,
  sectionBuilder,
}: {
  sectionBuilder?: ReactNode;
  document: AuthoredLevelDocument;
  selection: EditorSelection | null;
  onSelect(selection: EditorSelection): void;
  onAdd(type: "platform" | "moving-platform" | "sweeper" | "checkpoint"): void;
}) {
  const [tab, setTab] = useState<"objects" | "add">("objects");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const all = objectRows(document);
    return query ? all.filter((row) => row.searchText.includes(query)) : all;
  }, [document, search]);
  return (
    <aside className="editor-left-rail" aria-label="Level objects">
      <div className="editor-tab-list" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "objects"}
          onClick={() => setTab("objects")}
        >
          Objects
        </button>
        <button
          role="tab"
          aria-selected={tab === "add"}
          onClick={() => setTab("add")}
        >
          Add
        </button>
      </div>
      {tab === "objects" ? (
        <div className="editor-rail-scroll">
          <label className="editor-search">
            <span className="sr-only">Search by ID</span>
            <input
              type="search"
              placeholder="Search by ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {GROUPS.map((group) => {
            const grouped = rows.filter((row) => row.group === group);
            if (grouped.length === 0) return null;
            return (
              <section className="editor-object-group" key={group}>
                <h2>{group}</h2>
                {grouped.map((row) => (
                  <button
                    className="editor-object-row"
                    aria-current={
                      selectionKey(row.selection) === selectionKey(selection)
                        ? "true"
                        : undefined
                    }
                    key={row.key}
                    onClick={() => onSelect(row.selection)}
                  >
                    <span className={`editor-object-dot is-${row.group.toLocaleLowerCase()}`} />
                    <span>{row.label}</span>
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="editor-add-panel editor-rail-scroll">
          <button onClick={() => onAdd("platform")}>Platform</button>
          <button onClick={() => onAdd("moving-platform")}>
            Moving platform
          </button>
          <button onClick={() => onAdd("sweeper")}>Sweeper</button>
          <button onClick={() => onAdd("checkpoint")}>Checkpoint</button>
          <p>Gameplay objects are included with the template. Extra platforms can float outside the named routes.</p>
          {sectionBuilder}
        </div>
      )}
    </aside>
  );
}
