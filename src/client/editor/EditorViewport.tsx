import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type {
  AuthoredLevelDocument,
  AuthoredPosition,
} from "../../shared/authored-level";
import {
  EDITOR_ANCHOR_SLOTS,
  anchorForSlot,
  positionForSelection,
  selectionKey,
  type EditorAnchorSlot,
  type EditorSelection,
} from "./editor-selection";

export type EditorSnap = 0 | 0.25 | 0.3 | 0.5 | 1;

export interface EditorViewportHandle {
  frameLevel(): void;
  frameSelection(): void;
  viewCenter(): AuthoredPosition;
}

interface EditorViewportProps {
  active: boolean;
  document: AuthoredLevelDocument;
  selection: EditorSelection | null;
  snap: EditorSnap;
  onSelect(selection: EditorSelection | null): void;
  onMove(selection: EditorSelection, position: AuthoredPosition): void;
}

interface SceneEntry {
  readonly selection: EditorSelection;
  readonly root: THREE.Object3D;
}

const HONEY = 0xdca953;
const INK = 0x342c46;
const LEAF = 0x557363;
const PAPER = 0xf5ebdc;

function basicMaterial(color: number, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.02,
    transparent: opacity < 1,
    opacity,
  });
}

function selectedColor(selected: boolean, normal: number): number {
  return selected ? HONEY : normal;
}

function boxEdges(width: number, height: number, depth: number): THREE.EdgesGeometry {
  const source = new THREE.BoxGeometry(width, height, depth);
  const edges = new THREE.EdgesGeometry(source);
  source.dispose();
  return edges;
}

function selectionObject(
  selection: EditorSelection,
  object: THREE.Object3D,
): SceneEntry {
  object.userData.editorSelection = selection;
  return { selection, root: object };
}

function buildSceneEntries(
  document: AuthoredLevelDocument,
  selected: EditorSelection | null,
): { entries: SceneEntry[]; routeLines: THREE.Group } {
  const selectedKey = selectionKey(selected);
  const entries: SceneEntry[] = [];
  for (const piece of document.pieces) {
    const selection: EditorSelection = { type: "piece", id: piece.id };
    const active = selectedKey === selectionKey(selection);
    const root = new THREE.Group();
    root.name = `editor-piece-${piece.id}`;
    if (piece.type === "platform" || piece.type === "moving-platform") {
      root.position.copy(piece.center);
      const material = basicMaterial(
        selectedColor(active, piece.type === "moving-platform" ? 0x739ba0 : 0x9bb79d),
        piece.type === "moving-platform" ? 0.9 : 1,
      );
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(piece.size.x, piece.size.y, piece.size.z),
        material,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      if (piece.type === "moving-platform") {
        const axis = piece.motion.axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        mesh.position.copy(
          axis
            .clone()
            .multiplyScalar(
              piece.motion.distance * Math.sin(piece.motion.phase ?? 0),
            ),
        );
        const points = [
          axis.clone().multiplyScalar(-piece.motion.distance),
          axis.clone().multiplyScalar(piece.motion.distance),
        ];
        root.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineDashedMaterial({ color: INK, dashSize: 0.25, gapSize: 0.15 }),
          ),
        );
        (root.children.at(-1) as THREE.Line).computeLineDistances();
      }
    } else if (piece.type === "sweeper") {
      root.position.copy(piece.center);
      const visual = new THREE.Group();
      if (piece.motion) {
        const axis =
          piece.motion.axis === "x"
            ? new THREE.Vector3(1, 0, 0)
            : new THREE.Vector3(0, 0, 1);
        const points = [
          axis.clone().multiplyScalar(-piece.motion.distance),
          axis.clone().multiplyScalar(piece.motion.distance),
        ];
        const guide = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineDashedMaterial({
            color: INK,
            dashSize: 0.2,
            gapSize: 0.12,
          }),
        );
        guide.computeLineDistances();
        root.add(guide);
        visual.position.copy(
          axis
            .clone()
            .multiplyScalar(
              piece.motion.distance * Math.sin(piece.motion.phase ?? 0),
            ),
        );
      }
      visual.rotation.y = piece.rotation?.phase ?? 0;
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(piece.radius, piece.halfLength * 2, 6, 12),
        basicMaterial(selectedColor(active, 0xc97166)),
      );
      mesh.rotation.z = Math.PI / 2;
      mesh.castShadow = true;
      visual.add(mesh);
      if (piece.rotation) {
        const curve = new THREE.EllipseCurve(
          0,
          0,
          piece.halfLength,
          piece.halfLength,
          0,
          Math.PI * 2,
        );
        const rotationGuide = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(
            curve
              .getPoints(40)
              .map((point) => new THREE.Vector3(point.x, 0, point.y)),
          ),
          new THREE.LineBasicMaterial({ color: 0xb88278 }),
        );
        root.add(rotationGuide);
      }
      root.add(visual);
    } else {
      root.position.copy(piece.position);
      if (piece.activation.type === "box") {
        root.add(
          new THREE.LineSegments(
            boxEdges(
              piece.activation.halfExtents.x * 2,
              0.08,
              piece.activation.halfExtents.z * 2,
            ),
            new THREE.LineBasicMaterial({
              color: selectedColor(active, 0xd2a84f),
            }),
          ),
        );
      } else {
        const radius =
          piece.activation.type === "radius" ? piece.activation.radius : 0.48;
        const marker = new THREE.Mesh(
          new THREE.TorusGeometry(radius, 0.07, 8, 40),
          basicMaterial(selectedColor(active, 0xefd888)),
        );
        marker.rotation.x = Math.PI / 2;
        root.add(marker);
      }
    }
    entries.push(selectionObject(selection, root));
  }

  for (const slot of EDITOR_ANCHOR_SLOTS) {
    const anchor = anchorForSlot(document, slot);
    const selection: EditorSelection = { type: "anchor", slot };
    const active = selectedKey === selectionKey(selection);
    const root = new THREE.Group();
    root.name = `editor-anchor-${slot}`;
    root.position.copy(anchor.position);
    const color = anchorColor(slot);
    const marker = new THREE.Mesh(
      slot.startsWith("encounter.")
        ? new THREE.OctahedronGeometry(slot === "encounter.boss" ? 0.52 : 0.4)
        : slot.startsWith("memory.")
          ? new THREE.IcosahedronGeometry(0.34, 0)
          : slot.startsWith("friendly.")
            ? new THREE.SphereGeometry(0.3, 12, 8)
            : new THREE.ConeGeometry(0.3, 0.72, 8),
      basicMaterial(selectedColor(active, color)),
    );
    marker.position.y = slot.startsWith("encounter.") ? 0.5 : 0.38;
    marker.castShadow = true;
    root.add(marker);
    if ("arena" in anchor) {
      const width = anchor.arena.maxX - anchor.arena.minX;
      const depth = anchor.arena.maxZ - anchor.arena.minZ;
      const arena = new THREE.LineSegments(
        boxEdges(width, 0.04, depth),
        new THREE.LineBasicMaterial({ color: active ? HONEY : color }),
      );
      arena.position.set(
        (anchor.arena.minX + anchor.arena.maxX) / 2 - anchor.position.x,
        0.03,
        (anchor.arena.minZ + anchor.arena.maxZ) / 2 - anchor.position.z,
      );
      root.add(arena);
    }
    entries.push(selectionObject(selection, root));
  }

  const platformCenters = new Map(
    document.pieces.flatMap((piece) =>
      piece.type === "platform" || piece.type === "moving-platform"
        ? [[piece.id, piece.center] as const]
        : [],
    ),
  );
  const routeLines = new THREE.Group();
  routeLines.name = "editor-route-lines";
  document.connections.forEach((connection) => {
    const from = platformCenters.get(connection.from);
    const to = platformCenters.get(connection.to);
    if (!from || !to) return;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y + 0.45, from.z),
      new THREE.Vector3(to.x, to.y + 0.45, to.z),
    ]);
    const material = new THREE.LineDashedMaterial({
      color: connection.mode === "jump" ? HONEY : connection.mode === "ride" ? 0x658fa0 : LEAF,
      dashSize: connection.mode === "walk" ? 0.55 : 0.24,
      gapSize: connection.mode === "walk" ? 0.12 : 0.16,
      transparent: true,
      opacity: 0.82,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    routeLines.add(line);
  });
  return { entries, routeLines };
}

function anchorColor(slot: EditorAnchorSlot): number {
  if (slot.startsWith("encounter.")) return 0xb65f55;
  if (slot.startsWith("memory.")) return 0xc19446;
  if (slot.startsWith("friendly.")) return 0x4b9a77;
  if (slot.startsWith("pickup.")) return 0x647d9b;
  return INK;
}

export function disposeEditorObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => material.dispose());
  });
  root.removeFromParent();
}

function boxCorners(box: THREE.Box3): THREE.Vector3[] {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

export function editorCameraFitDistance(
  box: THREE.Box3,
  verticalFovDegrees: number,
  aspect: number,
  direction: THREE.Vector3,
  up = new THREE.Vector3(0, 1, 0),
): number {
  const viewDirection = direction.clone().normalize();
  if (viewDirection.lengthSq() < 1e-8)
    viewDirection.set(0.9, 0.8, 1.25).normalize();
  const right = new THREE.Vector3().crossVectors(up, viewDirection);
  if (right.lengthSq() < 1e-8) {
    const fallbackUp =
      Math.abs(viewDirection.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    right.crossVectors(fallbackUp, viewDirection);
  }
  right.normalize();
  const cameraUp = new THREE.Vector3()
    .crossVectors(viewDirection, right)
    .normalize();
  const center = box.getCenter(new THREE.Vector3());
  const verticalHalfFov = THREE.MathUtils.degToRad(verticalFovDegrees / 2);
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * Math.max(0.05, aspect),
  );
  const verticalSlope = Math.tan(verticalHalfFov) * 0.9;
  const horizontalSlope = Math.tan(horizontalHalfFov) * 0.9;
  const frontPadding = Math.max(0.5, box.getSize(new THREE.Vector3()).length() * 0.01);
  return boxCorners(box).reduce((distance, corner) => {
    const offset = corner.sub(center);
    const longitudinal = offset.dot(viewDirection);
    return Math.max(
      distance,
      longitudinal + Math.abs(offset.dot(right)) / horizontalSlope,
      longitudinal + Math.abs(offset.dot(cameraUp)) / verticalSlope,
      longitudinal + frontPadding,
    );
  }, 2);
}

function fitCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  box: THREE.Box3,
): void {
  if (box.isEmpty()) return;
  const direction = camera.position.clone().sub(controls.target).normalize();
  if (direction.lengthSq() < 1e-8) direction.set(0.9, 0.8, 1.25).normalize();
  const center = box.getCenter(new THREE.Vector3());
  const span = box.getSize(new THREE.Vector3()).length();
  const distance = editorCameraFitDistance(
    box,
    camera.fov,
    camera.aspect,
    direction,
    camera.up,
  );
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance);
  controls.maxDistance = Math.max(280, distance * 2);
  camera.near = 0.05;
  camera.far = Math.max(250, distance + span * 3);
  camera.updateProjectionMatrix();
  controls.update();
}

export const EditorViewport = forwardRef<
  EditorViewportHandle,
  EditorViewportProps
>(function EditorViewport(
  { active, document, selection, snap, onSelect, onMove },
  forwardedRef,
) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    transform: TransformControls;
    content: THREE.Group;
    entries: SceneEntry[];
  } | null>(null);
  const [failure, setFailure] = useState(false);
  const hasFramed = useRef(false);
  const animation = useRef<{ start(): void; stop(): void } | null>(null);
  const callbacks = useRef({ onSelect, onMove });
  callbacks.current = { onSelect, onMove };

  useImperativeHandle(forwardedRef, () => ({
    frameLevel(): void {
      const current = runtime.current;
      if (!current) return;
      fitCamera(
        current.camera,
        current.controls,
        new THREE.Box3().setFromObject(current.content),
      );
    },
    frameSelection(): void {
      const current = runtime.current;
      if (!current) return;
      const entry = current.entries.find(
        (candidate) => selectionKey(candidate.selection) === selectionKey(selection),
      );
      if (!entry) return;
      fitCamera(
        current.camera,
        current.controls,
        new THREE.Box3().setFromObject(entry.root).expandByScalar(1.5),
      );
    },
    viewCenter(): AuthoredPosition {
      const target = runtime.current?.controls.target;
      return target
        ? { x: target.x, y: target.y, z: target.z }
        : { x: 0, y: 0, z: 0 };
    },
  }), [selection]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailure(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, container.ownerDocument.defaultView?.devicePixelRatio ?? 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.dataset.editorCanvas = "true";
    renderer.domElement.setAttribute("aria-label", "3D level view");
    renderer.domElement.tabIndex = 0;
    container.append(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAPER);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.08, 600);
    camera.position.set(22, 18, 28);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 280;
    controls.target.set(0, 0, -35);

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode("translate");
    transform.setSpace("world");
    transform.setSize(0.82);
    scene.add(transform.getHelper());

    const fill = new THREE.HemisphereLight(0xfff7e9, 0x596d69, 2.1);
    scene.add(fill);
    const sun = new THREE.DirectionalLight(0xfff0ce, 2.7);
    sun.position.set(25, 38, 18);
    sun.castShadow = true;
    scene.add(sun);
    const grid = new THREE.GridHelper(320, 320, HONEY, 0xb8aa93);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.42;
    const axes = new THREE.AxesHelper(4);
    scene.add(grid, axes);
    const content = new THREE.Group();
    scene.add(content);
    runtime.current = { camera, controls, transform, content, entries: [] };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart: { x: number; y: number } | null = null;
    let transformStart: THREE.Vector3 | null = null;
    let transformSelection: EditorSelection | null = null;

    const pointerDown = (event: PointerEvent) => {
      if (event.button === 0)
        pointerStart = { x: event.clientX, y: event.clientY };
    };
    const pointerUp = (event: PointerEvent) => {
      const start = pointerStart;
      pointerStart = null;
      if (!start || event.button !== 0 || transform.dragging) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        runtime.current?.entries.map((entry) => entry.root) ?? [],
        true,
      );
      const hit = hits[0]?.object;
      let target: THREE.Object3D | null = hit ?? null;
      while (target && !target.userData.editorSelection)
        target = target.parent;
      callbacks.current.onSelect(
        (target?.userData.editorSelection as EditorSelection | undefined) ?? null,
      );
    };
    const transformDown = () => {
      controls.enabled = false;
      transformStart = transform.object?.position.clone() ?? null;
      transformSelection =
        (transform.object?.userData.editorSelection as EditorSelection | undefined) ?? null;
    };
    const transformUp = () => {
      controls.enabled = true;
      const object = transform.object;
      if (
        object &&
        transformStart &&
        transformSelection &&
        object.position.distanceToSquared(transformStart) > 1e-10
      ) {
        callbacks.current.onMove(transformSelection, {
          x: object.position.x,
          y: object.position.y,
          z: object.position.z,
        });
      }
      transformStart = null;
      transformSelection = null;
    };
    const cancelPointer = () => {
      pointerStart = null;
      if (transformStart) {
        transform.reset();
        transformStart = null;
        transformSelection = null;
        transform.pointerUp(null);
      }
      controls.enabled = true;
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", cancelPointer);
    renderer.domElement.addEventListener("lostpointercapture", cancelPointer);
    transform.addEventListener("mouseDown", transformDown);
    transform.addEventListener("mouseUp", transformUp);
    container.ownerDocument.defaultView?.addEventListener("blur", cancelPointer);
    container.ownerDocument.defaultView?.addEventListener("pagehide", cancelPointer);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const Observer = container.ownerDocument.defaultView?.ResizeObserver;
    const observer = Observer ? new Observer(resize) : null;
    observer?.observe(container);
    container.ownerDocument.defaultView?.addEventListener("resize", resize);
    resize();

    let frame: number | null = null;
    const draw = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    const start = () => {
      if (frame !== null) return;
      resize();
      draw();
    };
    const stop = () => {
      if (frame === null) return;
      cancelAnimationFrame(frame);
      frame = null;
    };
    animation.current = { start, stop };
    if (active) start();

    return () => {
      stop();
      observer?.disconnect();
      container.ownerDocument.defaultView?.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", cancelPointer);
      renderer.domElement.removeEventListener("lostpointercapture", cancelPointer);
      transform.removeEventListener("mouseDown", transformDown);
      transform.removeEventListener("mouseUp", transformUp);
      container.ownerDocument.defaultView?.removeEventListener("blur", cancelPointer);
      container.ownerDocument.defaultView?.removeEventListener("pagehide", cancelPointer);
      transform.detach();
      transform.dispose();
      controls.dispose();
      disposeEditorObjectTree(content);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      axes.geometry.dispose();
      (axes.material as THREE.Material).dispose();
      sun.shadow.dispose();
      sun.dispose();
      fill.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
      animation.current = null;
    };
  }, []);

  useEffect(() => {
    if (active) animation.current?.start();
    else animation.current?.stop();
  }, [active]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    current.transform.translationSnap = snap || null;
  }, [snap]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    current.transform.detach();
    for (const child of [...current.content.children])
      disposeEditorObjectTree(child);
    const built = buildSceneEntries(document, selection);
    current.entries = built.entries;
    current.content.add(
      built.routeLines,
      ...built.entries.map((entry) => entry.root),
    );
    if (!hasFramed.current) {
      hasFramed.current = true;
      fitCamera(
        current.camera,
        current.controls,
        new THREE.Box3().setFromObject(current.content),
      );
    }
    const selectedEntry = built.entries.find(
      (entry) => selectionKey(entry.selection) === selectionKey(selection),
    );
    if (selectedEntry) current.transform.attach(selectedEntry.root);
  }, [document, selection]);

  if (failure) {
    return (
      <div className="editor-viewport-failure" role="alert">
        This browser couldn’t open the 3D world. Try a browser with WebGL enabled.
      </div>
    );
  }

  return (
    <div className="editor-viewport" ref={host}>
      <span className="editor-viewport-hint">
        Drag to orbit · Right-drag to pan · Wheel to move closer
      </span>
      {selection && !positionForSelection(document, selection) && (
        <span className="editor-viewport-notice">Draft</span>
      )}
    </div>
  );
});
