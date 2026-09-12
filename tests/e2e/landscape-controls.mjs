import assert from "node:assert/strict";

// Call only after normal traversal has collected the shield.
export async function verifyLandscapeControls({ page, screenshot }) {
  assert.deepEqual(page.viewportSize(), { width: 844, height: 390 });
  const attack = page.getByRole("button", { name: "Attack", exact: true });
  const bash = page.getByRole("button", { name: "Bash", exact: true });
  const joystick = page.getByTestId("joystick");
  const header = page.locator(".game-header");
  await Promise.all([
    attack.waitFor(),
    bash.waitFor(),
    joystick.waitFor(),
    header.waitFor(),
  ]);
  const [attackBox, bashBox, joystickBox, headerBox] = await Promise.all([
    attack.boundingBox(),
    bash.boundingBox(),
    joystick.boundingBox(),
    header.boundingBox(),
  ]);
  assert.ok(attackBox && bashBox && joystickBox && headerBox);
  const withinViewport = (box) =>
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= 844 &&
    box.y + box.height <= 390;
  const overlapArea = (left, right) =>
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
  for (const box of [attackBox, bashBox, joystickBox, headerBox])
    assert.equal(withinViewport(box), true, "landscape control left viewport");
  assert.ok(
    attackBox.width * attackBox.height > bashBox.width * bashBox.height,
    "landscape Attack target was not larger than Bash",
  );
  for (const actionBox of [attackBox, bashBox]) {
    assert.equal(overlapArea(actionBox, joystickBox), 0);
    assert.equal(overlapArea(actionBox, headerBox), 0);
  }
  await screenshot("landscape-controls");

  await page.getByRole("button", { name: "How to play" }).tap();
  const dialog = page.getByRole("dialog", {
    name: "Explore. Prepare. Face the era.",
  });
  await dialog.waitFor();
  const close = dialog.getByRole("button", { name: "Back to the adventure" });
  await close.waitFor();
  assert.equal(await close.isVisible(), true);
  await screenshot("landscape-help");
  await close.tap();
  await dialog.waitFor({ state: "detached" });

  return {
    viewport: { width: 844, height: 390 },
    attack: attackBox,
    bash: bashBox,
    joystick: joystickBox,
    header: headerBox,
    helpOpenedAndClosed: true,
  };
}
