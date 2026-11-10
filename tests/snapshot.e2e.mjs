import test from "node:test";
import assert from "node:assert/strict";
import { BrowserEngine } from "../src/browser.mjs";

for (const linked of [true, false])
  test(`${linked ? "associated" : "anonymous"} portalled choices precede the compact limit and remaining controls paginate without gaps`, async () => {
    const browser = new BrowserEngine();
    try {
      await browser.start({ headed: false });
      await browser.page.setContent(
        `<div role="dialog"><div id="combo" role="combobox" aria-label="Leave subtype" aria-expanded="false" ${linked ? 'aria-controls="choices"' : ""} onclick="this.setAttribute('aria-expanded','true');document.getElementById('choices').hidden=false">Annual</div>${Array.from({ length: 75 }, (_, i) => `<button id="control-${i}">Control ${i}</button>`).join("")}</div><div id="choices" role="listbox" hidden><div role="listbox">${["Annual", "Half-day", "Late", "Early leave", "Out"].map((label, i) => `<div id="choice-${i}" role="option" onclick="document.getElementById('combo').textContent=this.textContent;document.getElementById('combo').setAttribute('aria-expanded','false');document.getElementById('choices').hidden=true">${label}</div>`).join("")}</div></div>`,
      );
      let screen = await browser.snapshot();
      assert.equal(screen.limit, 35);
      assert.equal(screen.hasMore, true);
      assert.equal(screen.nextOffset, 35);
      screen = await browser.execute({
        action: "click",
        ref: screen.elements.find((e) => e.id === "combo").ref,
      });
      assert.equal(screen.selection.optionCount, 5);
      assert.deepEqual(
        screen.elements.slice(0, 5).map((e) => e.role),
        Array(5).fill("option"),
      );
      const stale = screen.elements.find((e) => e.id === "choice-3").ref,
        ids = screen.elements.map((e) => e.id);
      while (screen.hasMore) {
        screen = await browser.snapshot({ offset: screen.nextOffset });
        ids.push(...screen.elements.map((e) => e.id));
      }
      assert.equal(screen.nextOffset, null);
      assert.equal(ids.length, screen.totalElements);
      assert.equal(new Set(ids).size, ids.length);
      await assert.rejects(
        browser.execute({ action: "click", ref: stale }),
        (e) => e.code === "STALE_REF",
      );
      const filtered = await browser.snapshot({ filter: "Early leave" });
      assert.equal(filtered.elements.length, 1);
      await browser.execute({ action: "click", ref: filtered.elements[0].ref });
      const selected = await browser.snapshot({ selector: "#combo" });
      assert.equal(selected.elements[0].display, "Early leave");
      assert.equal(selected.elements[0].expanded, false);
      assert.equal(selected.selection, null);
    } finally {
      await browser.browser?.close();
    }
  });

test("large open lists support filtered follow-up while explicit selectors keep their scope", async () => {
  const browser = new BrowserEngine();
  try {
    await browser.start({ headed: false });
    await browser.page.setContent(
      `<div role="combobox" aria-label="Minute" aria-expanded="true" aria-controls="minutes">00</div><button id="requested">Only this control</button><div id="minutes" role="listbox">${Array.from({ length: 120 }, (_, i) => `<div role="option">Minute ${i}</div>`).join("")}</div>`,
    );
    const compact = await browser.snapshot();
    assert.equal(compact.elements.length, 35);
    assert(!compact.elements.some((e) => e.label === "Minute 119"));
    const later = await browser.snapshot({ filter: "Minute 119" });
    assert.equal(later.elements.length, 1);
    assert.equal(later.elements[0].label, "Minute 119");
    assert.equal(later.hasMore, false);
    const scoped = await browser.snapshot({ selector: "#requested" });
    assert.deepEqual(
      scoped.elements.map((e) => e.id),
      ["requested"],
    );
    assert.equal(scoped.selection, null);
  } finally {
    await browser.browser?.close();
  }
});
