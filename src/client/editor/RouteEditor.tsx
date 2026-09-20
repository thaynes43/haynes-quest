import { useEffect, useRef, useState } from "react";
import type {
  AuthoredConnection,
  AuthoredConnectionMode,
  AuthoredLevelDocument,
} from "../../shared/authored-level";
import { platformIds, staticPlatformIds } from "./editor-selection";

function SequenceField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: readonly string[];
  onCommit(value: readonly string[]): void;
}) {
  const serialized = value.join(", ");
  const [text, setText] = useState(serialized);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(serialized);
  }, [serialized]);
  const commit = () => {
    editing.current = false;
    const next = text
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    setText(next.join(", "));
    if (next.join("\0") !== value.join("\0")) onCommit(next);
  };
  return (
    <label className="editor-field editor-sequence-field">
      <span>{label}</span>
      <textarea
        rows={3}
        value={text}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setText(serialized);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function ConnectionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  allowEmpty = false,
}: {
  label: string;
  value: T | "";
  options: readonly T[];
  onChange(value: T | ""): void;
  allowEmpty?: boolean;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T | "")}
      >
        {allowEmpty && <option value="" />}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RouteEditor({
  document,
  onAddConnection,
  onUpdateConnection,
  onRemoveConnection,
  onSetMainPath,
  onAddBranch,
  onUpdateBranch,
  onRemoveBranch,
}: {
  document: AuthoredLevelDocument;
  onAddConnection(connection: AuthoredConnection): void;
  onUpdateConnection(index: number, connection: AuthoredConnection): void;
  onRemoveConnection(index: number): void;
  onSetMainPath(platformIds: readonly string[]): void;
  onAddBranch(platformIds: readonly string[]): void;
  onUpdateBranch(index: number, platformIds: readonly string[]): void;
  onRemoveBranch(index: number): void;
}) {
  const platforms = platformIds(document);
  const safePlatforms = staticPlatformIds(document);
  const addConnection = () => {
    const from = platforms[0];
    const to = platforms[1] ?? platforms[0];
    if (!from || !to) return;
    onAddConnection({ from, to, mode: "walk" });
  };
  return (
    <div className="editor-route-editor">
      <section className="editor-route-section">
        <div className="editor-section-heading">
          <h2>Connections</h2>
          <button type="button" onClick={addConnection} disabled={!platforms.length}>
            Add connection
          </button>
        </div>
        <div className="editor-connection-list">
          {document.connections.map((connection, index) => (
            <div className="editor-connection" key={`${connection.from}:${connection.to}:${index}`}>
              <ConnectionSelect
                label="From"
                value={connection.from}
                options={platforms}
                onChange={(from) => {
                  if (from) onUpdateConnection(index, { ...connection, from });
                }}
              />
              <ConnectionSelect
                label="To"
                value={connection.to}
                options={platforms}
                onChange={(to) => {
                  if (to) onUpdateConnection(index, { ...connection, to });
                }}
              />
              <ConnectionSelect<AuthoredConnectionMode>
                label="Mode"
                value={connection.mode}
                options={["walk", "jump", "ride"]}
                onChange={(mode) => {
                  if (mode) onUpdateConnection(index, { ...connection, mode });
                }}
              />
              <ConnectionSelect
                label="Safe landing"
                value={connection.safeMissPlatformId ?? ""}
                options={safePlatforms}
                allowEmpty
                onChange={(safeMissPlatformId) => {
                  const next = { ...connection };
                  if (safeMissPlatformId)
                    next.safeMissPlatformId = safeMissPlatformId;
                  else delete next.safeMissPlatformId;
                  onUpdateConnection(index, next);
                }}
              />
              <button
                type="button"
                className="editor-remove-row"
                onClick={() => onRemoveConnection(index)}
              >
                Remove connection
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="editor-route-section">
        <h2>Main route</h2>
        <SequenceField
          label="IDs"
          value={document.mainPath}
          onCommit={onSetMainPath}
        />
      </section>
      <section className="editor-route-section">
        <div className="editor-section-heading">
          <h2>Branches</h2>
          <button type="button" onClick={() => onAddBranch([])}>
            Add branch
          </button>
        </div>
        {document.branches.map((branch, index) => (
          <div className="editor-branch" key={index}>
            <SequenceField
              label={`${index + 1}`}
              value={branch}
              onCommit={(value) => onUpdateBranch(index, value)}
            />
            <button type="button" onClick={() => onRemoveBranch(index)}>
              Remove branch
            </button>
          </div>
        ))}
      </section>
      <section className="editor-route-section">
        <h2>Current IDs</h2>
        <p className="editor-id-reference">{platforms.join(", ")}</p>
      </section>
    </div>
  );
}
