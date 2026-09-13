import assert from "node:assert/strict";

export const CONTROL_VIEWPORTS = [
  { id: "phone-portrait", width: 390, height: 844, stick: [170, 184] },
  { id: "phone-landscape", width: 844, height: 390, stick: [139, 141] },
  { id: "tablet-portrait", width: 768, height: 1024, stick: [199, 201] },
  { id: "tablet-landscape", width: 1024, height: 768, stick: [199, 201] },
];

export const overlapArea = (left, right) =>
  Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) -
      Math.max(left.x, right.x),
  ) *
  Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y),
  );

export function assertControlBounds(viewport, boxes, expectedStick) {
  const withinViewport = (box) =>
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height;
  for (const [name, box] of Object.entries(boxes)) {
    assert.ok(box, `${name} has no rendered bounds`);
    assert.equal(
      withinViewport(box),
      true,
      `${name} left the ${viewport.width}x${viewport.height} viewport`,
    );
  }
  assert.ok(
    boxes.joystick.width >= expectedStick[0] &&
      boxes.joystick.width <= expectedStick[1],
    `joystick width ${boxes.joystick.width} is outside ${expectedStick.join("-")}`,
  );
  assert.equal(boxes.joystick.width, boxes.joystick.height);
  assert.equal(boxes.jump.width, boxes.jump.height);
  assert.ok(
    boxes.attack.width * boxes.attack.height >
      boxes.secondary.width * boxes.secondary.height,
    "Attack target was not larger than Secondary",
  );

  const joystickCenter = {
    x: boxes.joystick.x + boxes.joystick.width / 2,
    y: boxes.joystick.y + boxes.joystick.height / 2,
  };
  const jumpCenter = {
    x: boxes.jump.x + boxes.jump.width / 2,
    y: boxes.jump.y + boxes.jump.height / 2,
  };
  assert.ok(
    joystickCenter.x < viewport.width / 2 &&
      joystickCenter.y > viewport.height / 2,
    "joystick is not in the lower-left thumb region",
  );
  assert.ok(
    jumpCenter.x > viewport.width / 2 && jumpCenter.y > viewport.height / 2,
    "Jump is not in the lower-right thumb region",
  );

  for (const action of [boxes.jump, boxes.attack, boxes.secondary]) {
    assert.equal(overlapArea(action, boxes.joystick), 0);
    assert.equal(overlapArea(action, boxes.header), 0);
  }
  assert.equal(overlapArea(boxes.joystick, boxes.header), 0);
  assert.equal(overlapArea(boxes.jump, boxes.attack), 0);
  assert.equal(overlapArea(boxes.jump, boxes.secondary), 0);
  assert.equal(overlapArea(boxes.attack, boxes.secondary), 0);
}

async function readControlBounds(page) {
  const controls = {
    jump: page.getByRole("button", { name: "Jump", exact: true }),
    attack: page.getByRole("button", { name: "Attack", exact: true }),
    secondary: page.getByRole("button", { name: "Bash", exact: true }),
    joystick: page.getByTestId("joystick"),
    header: page.locator(".game-header"),
  };
  await Promise.all(
    Object.values(controls).map((control) => control.waitFor()),
  );
  const entries = await Promise.all(
    Object.entries(controls).map(async ([name, control]) => [
      name,
      await control.boundingBox(),
    ]),
  );
  return Object.fromEntries(entries);
}

// Call only after normal traversal has collected the secondary tool.
export async function verifyControlLayouts({ page, screenshot }) {
  const original = page.viewportSize();
  assert.ok(original, "control check needs an explicit viewport");
  const layouts = [];
  for (const viewport of CONTROL_VIEWPORTS) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.waitForTimeout(120);
    const actual = page.viewportSize();
    assert.deepEqual(actual, {
      width: viewport.width,
      height: viewport.height,
    });
    const boxes = await readControlBounds(page);
    assertControlBounds(actual, boxes, viewport.stick);
    await screenshot(`controls-${viewport.id}`);
    layouts.push({
      id: viewport.id,
      viewport: actual,
      ...boxes,
    });
  }

  await page.setViewportSize(original);
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: "How to play" }).tap();
  const dialog = page.getByRole("dialog", {
    name: "Explore. Prepare. Face the era.",
  });
  await dialog.waitFor();
  const close = dialog.getByRole("button", { name: "Back to the adventure" });
  await close.waitFor();
  assert.equal(await close.isVisible(), true);
  await screenshot("controls-help");
  await close.tap();
  await dialog.waitFor({ state: "detached" });

  return {
    layouts,
    restoredViewport: page.viewportSize(),
    helpOpenedAndClosed: true,
  };
}

export const verifyLandscapeControls = verifyControlLayouts;
