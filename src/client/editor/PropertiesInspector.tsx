import type {
  AuthoredAnchor,
  AuthoredEncounterAnchor,
  AuthoredLevelDocument,
  AuthoredLevelPiece,
  AuthoredPosition,
} from "../../shared/authored-level";
import { NumberField, PositionFields, SelectField, TextField } from "./EditorFields";
import {
  anchorForSelection,
  isEncounterAnchor,
  labelForAnchor,
  pieceForSelection,
  platformIds,
  type EditorSelection,
} from "./editor-selection";

interface PropertiesInspectorProps {
  document: AuthoredLevelDocument;
  selection: EditorSelection | null;
  moveAttached: boolean;
  onMoveAttachedChange(value: boolean): void;
  onMove(position: AuthoredPosition): void;
  onUpdatePiece(piece: AuthoredLevelPiece): void;
  onRenamePiece(id: string): void;
  onUpdateAnchor(anchor: AuthoredAnchor | AuthoredEncounterAnchor): void;
  onDuplicatePiece(): void;
  onDeletePiece(): void;
}

function DimensionFields({
  size,
  onCommit,
}: {
  size: AuthoredPosition;
  onCommit(size: AuthoredPosition): void;
}) {
  return (
    <div className="editor-field-grid">
      <NumberField
        label="Width"
        value={size.x}
        min={0.01}
        onCommit={(x) => onCommit({ ...size, x })}
      />
      <NumberField
        label="Height"
        value={size.y}
        min={0.01}
        onCommit={(y) => onCommit({ ...size, y })}
      />
      <NumberField
        label="Depth"
        value={size.z}
        min={0.01}
        onCommit={(z) => onCommit({ ...size, z })}
      />
    </div>
  );
}

function PieceProperties({
  document,
  piece,
  moveAttached,
  onMoveAttachedChange,
  onMove,
  onUpdate,
  onRename,
  onDuplicate,
  onDelete,
}: {
  document: AuthoredLevelDocument;
  piece: AuthoredLevelPiece;
  moveAttached: boolean;
  onMoveAttachedChange(value: boolean): void;
  onMove(position: AuthoredPosition): void;
  onUpdate(piece: AuthoredLevelPiece): void;
  onRename(id: string): void;
  onDuplicate(): void;
  onDelete(): void;
}) {
  const allPlatforms = platformIds(document);
  const position = piece.type === "checkpoint" ? piece.position : piece.center;
  const boxActivation =
    piece.type === "checkpoint" && piece.activation.type === "box"
      ? piece.activation
      : null;
  return (
    <>
      <TextField label="ID" value={piece.id} onCommit={onRename} />
      <div className="editor-readonly-field">
        <span>Type</span>
        <strong>{piece.type}</strong>
      </div>
      <fieldset className="editor-fieldset">
        <legend>Position</legend>
        <PositionFields position={position} onCommit={onMove} />
        {(piece.type === "platform" || piece.type === "moving-platform") && (
          <label className="editor-check-field">
            <input
              type="checkbox"
              checked={moveAttached}
              onChange={(event) => onMoveAttachedChange(event.target.checked)}
            />
            <span>Move attached objects</span>
          </label>
        )}
      </fieldset>
      {(piece.type === "platform" || piece.type === "moving-platform") && (
        <fieldset className="editor-fieldset">
          <legend>Dimensions</legend>
          <DimensionFields
            size={piece.size}
            onCommit={(size) => onUpdate({ ...piece, size })}
          />
        </fieldset>
      )}
      {piece.type === "moving-platform" && (
        <fieldset className="editor-fieldset">
          <legend>Motion</legend>
          <div className="editor-field-grid">
            <SelectField
              label="Axis"
              value={piece.motion.axis}
              options={["x", "z"]}
              onCommit={(axis) =>
                onUpdate({ ...piece, motion: { ...piece.motion, axis } })
              }
            />
            <NumberField
              label="Travel"
              value={piece.motion.distance}
              min={0.01}
              onCommit={(distance) =>
                onUpdate({ ...piece, motion: { ...piece.motion, distance } })
              }
            />
            <NumberField
              label="Period"
              value={piece.motion.period}
              min={0.01}
              onCommit={(period) =>
                onUpdate({ ...piece, motion: { ...piece.motion, period } })
              }
            />
            <NumberField
              label="Phase"
              value={piece.motion.phase ?? 0}
              onCommit={(phase) =>
                onUpdate({ ...piece, motion: { ...piece.motion, phase } })
              }
            />
          </div>
        </fieldset>
      )}
      {piece.type === "sweeper" && (
        <>
          <fieldset className="editor-fieldset">
            <legend>Dimensions</legend>
            <div className="editor-field-grid">
              <NumberField
                label="Radius"
                value={piece.radius}
                min={0.01}
                onCommit={(radius) => onUpdate({ ...piece, radius })}
              />
              <NumberField
                label="Half length"
                value={piece.halfLength}
                min={0.01}
                onCommit={(halfLength) => onUpdate({ ...piece, halfLength })}
              />
            </div>
          </fieldset>
          {piece.motion && (
            <fieldset className="editor-fieldset">
              <legend>Motion</legend>
              <div className="editor-field-grid">
                <SelectField
                  label="Axis"
                  value={piece.motion.axis}
                  options={["x", "z"]}
                  onCommit={(axis) =>
                    onUpdate({ ...piece, motion: { ...piece.motion!, axis } })
                  }
                />
                <NumberField
                  label="Travel"
                  value={piece.motion.distance}
                  min={0.01}
                  onCommit={(distance) =>
                    onUpdate({
                      ...piece,
                      motion: { ...piece.motion!, distance },
                    })
                  }
                />
                <NumberField
                  label="Period"
                  value={piece.motion.period}
                  min={0.01}
                  onCommit={(period) =>
                    onUpdate({ ...piece, motion: { ...piece.motion!, period } })
                  }
                />
                <NumberField
                  label="Phase"
                  value={piece.motion.phase ?? 0}
                  onCommit={(phase) =>
                    onUpdate({ ...piece, motion: { ...piece.motion!, phase } })
                  }
                />
              </div>
            </fieldset>
          )}
          {piece.rotation && (
            <fieldset className="editor-fieldset">
              <legend>Rotation</legend>
              <div className="editor-field-grid">
                <NumberField
                  label="Period"
                  value={piece.rotation.period}
                  min={0.01}
                  onCommit={(period) =>
                    onUpdate({
                      ...piece,
                      rotation: { ...piece.rotation!, period },
                    })
                  }
                />
                <NumberField
                  label="Phase"
                  value={piece.rotation.phase ?? 0}
                  onCommit={(phase) =>
                    onUpdate({
                      ...piece,
                      rotation: { ...piece.rotation!, phase },
                    })
                  }
                />
              </div>
            </fieldset>
          )}
        </>
      )}
      {piece.type === "checkpoint" && (
        <fieldset className="editor-fieldset">
          <legend>Activation</legend>
          <SelectField
            label="Platform"
            value={piece.platformId}
            options={allPlatforms}
            onCommit={(platformId) => onUpdate({ ...piece, platformId })}
          />
          <SelectField
            label="Type"
            value={piece.activation.type}
            options={["platform", "radius", "box"]}
            onCommit={(type) => {
              if (type === "platform")
                onUpdate({ ...piece, activation: { type } });
              if (type === "radius")
                onUpdate({ ...piece, activation: { type, radius: 1 } });
              if (type === "box")
                onUpdate({
                  ...piece,
                  activation: { type, halfExtents: { x: 1, z: 1 } },
                });
            }}
          />
          {piece.activation.type === "radius" && (
            <NumberField
              label="Radius"
              value={piece.activation.radius}
              min={0.01}
              onCommit={(radius) =>
                onUpdate({
                  ...piece,
                  activation: { type: "radius", radius },
                })
              }
            />
          )}
          {boxActivation && (
            <div className="editor-field-grid">
              <NumberField
                label="X"
                value={boxActivation.halfExtents.x}
                min={0.01}
                onCommit={(x) =>
                  onUpdate({
                    ...piece,
                    activation: {
                      type: "box",
                      halfExtents: { x, z: boxActivation.halfExtents.z },
                    },
                  })
                }
              />
              <NumberField
                label="Z"
                value={boxActivation.halfExtents.z}
                min={0.01}
                onCommit={(z) =>
                  onUpdate({
                    ...piece,
                    activation: {
                      type: "box",
                      halfExtents: { x: boxActivation.halfExtents.x, z },
                    },
                  })
                }
              />
            </div>
          )}
        </fieldset>
      )}
      <div className="editor-inspector-actions">
        <button type="button" onClick={onDuplicate}>
          Duplicate
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </>
  );
}

function AnchorProperties({
  document,
  selection,
  anchor,
  onMove,
  onUpdate,
}: {
  document: AuthoredLevelDocument;
  selection: Extract<EditorSelection, { type: "anchor" }>;
  anchor: AuthoredAnchor | AuthoredEncounterAnchor;
  onMove(position: AuthoredPosition): void;
  onUpdate(anchor: AuthoredAnchor | AuthoredEncounterAnchor): void;
}) {
  const checkpoints = document.pieces
    .filter((piece) => piece.type === "checkpoint")
    .map((piece) => piece.id);
  return (
    <>
      <div className="editor-readonly-field">
        <span>ID</span>
        <strong>{selection.slot}</strong>
      </div>
      <div className="editor-readonly-field">
        <span>Type</span>
        <strong>{labelForAnchor(selection.slot)}</strong>
      </div>
      <fieldset className="editor-fieldset">
        <legend>Position</legend>
        <PositionFields position={anchor.position} onCommit={onMove} />
      </fieldset>
      <SelectField
        label="Platform"
        value={anchor.platformId}
        options={platformIds(document)}
        onCommit={(platformId) => onUpdate({ ...anchor, platformId })}
      />
      {isEncounterAnchor(anchor) && (
        <>
          <SelectField
            label="Checkpoint"
            value={anchor.checkpointId}
            options={checkpoints}
            onCommit={(checkpointId) => onUpdate({ ...anchor, checkpointId })}
          />
          <fieldset className="editor-fieldset">
            <legend>Arena</legend>
            <div className="editor-field-grid">
              <NumberField
                label="Min X"
                value={anchor.arena.minX}
                onCommit={(minX) =>
                  onUpdate({ ...anchor, arena: { ...anchor.arena, minX } })
                }
              />
              <NumberField
                label="Max X"
                value={anchor.arena.maxX}
                onCommit={(maxX) =>
                  onUpdate({ ...anchor, arena: { ...anchor.arena, maxX } })
                }
              />
              <NumberField
                label="Min Z"
                value={anchor.arena.minZ}
                onCommit={(minZ) =>
                  onUpdate({ ...anchor, arena: { ...anchor.arena, minZ } })
                }
              />
              <NumberField
                label="Max Z"
                value={anchor.arena.maxZ}
                onCommit={(maxZ) =>
                  onUpdate({ ...anchor, arena: { ...anchor.arena, maxZ } })
                }
              />
            </div>
          </fieldset>
        </>
      )}
    </>
  );
}

export function PropertiesInspector(props: PropertiesInspectorProps) {
  const piece = pieceForSelection(props.document, props.selection);
  const anchor = anchorForSelection(props.document, props.selection);
  if (!props.selection)
    return (
      <p className="editor-empty-state">
        Select an object to edit its properties.
      </p>
    );
  if (piece)
    return (
      <PieceProperties
        document={props.document}
        piece={piece}
        moveAttached={props.moveAttached}
        onMoveAttachedChange={props.onMoveAttachedChange}
        onMove={props.onMove}
        onUpdate={props.onUpdatePiece}
        onRename={props.onRenamePiece}
        onDuplicate={props.onDuplicatePiece}
        onDelete={props.onDeletePiece}
      />
    );
  if (anchor && props.selection.type === "anchor")
    return (
      <AnchorProperties
        document={props.document}
        selection={props.selection}
        anchor={anchor}
        onMove={props.onMove}
        onUpdate={props.onUpdateAnchor}
      />
    );
  return (
    <p className="editor-empty-state">Select an object to edit its properties.</p>
  );
}
