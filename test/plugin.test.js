import test from "node:test";
import assert from "node:assert/strict";
import { apply } from "../lib/index.js";

test("registers DSH tools and executes the review-only draft tool", async () => {
  const tools = [];
  const sections = [];
  apply({
    tools: { register: (tool) => tools.push(tool) },
    systemPrompt: { section: (section) => sections.push(section) },
  }, {});
  assert.deepEqual(tools.map((tool) => tool.name), [
    "dongqiudi_news",
    "dongqiudi_article",
    "dongqiudi_prepare_reply",
  ]);
  assert.equal(sections.length, 1);
  const draft = await tools[2].execute({
    article: "6546419",
    text: "主场比赛先做好防守，争取三分。",
  });
  assert.equal(draft.status, "draft");
  assert.equal(draft.published, false);
});
