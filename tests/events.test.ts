import { describe, test, expect, beforeAll } from "vitest";
import { runDocGenerator, DocsResult } from "./helper";

describe("events documentation", () => {
  let docs: DocsResult;
  beforeAll(() => {
    docs = runDocGenerator("events");
  });

  test("event property gets pmeType event and sender/options names", () => {
    const event = docs.findPME("SurveyModel", "onComplete");
    expect(event.pmeType).toBe("event");
    expect(event.eventSenderName).toBe("SurveyModel");
    expect(event.eventOptionsName).toBe("CompleteEventOptions");
  });

  test("undocumented event is removed from the output", () => {
    expect(docs.findPME("SurveyModel", "onUndocumented")).toBeUndefined();
  });

  test("Parameters block is appended to the event documentation", () => {
    const doc: string = docs.findPME("SurveyModel", "onComplete").documentation;
    expect(doc.indexOf("An event raised when the survey is completed.")).toBe(0);
    expect(doc).toContain("Parameters:");
    expect(doc).toContain("- `sender`: `SurveyModel`");
    expect(doc).toContain("A survey instance that raised the event.");
    expect(doc).toContain("- `options.data`: `any`");
    expect(doc).toContain("The survey results.");
  });

  test("options members are collected from implemented interfaces too", () => {
    const doc: string = docs.findPME("SurveyModel", "onComplete").documentation;
    expect(doc).toContain("- `options.allowCancel`: `boolean`");
  });

  test("hidden and obsolete options members are not documented", () => {
    const doc: string = docs.findPME("SurveyModel", "onComplete").documentation;
    expect(doc).not.toContain("options.internalFlag");
    expect(doc).not.toContain("options.cancel");
  });

  test("the placeholder sentence is replaced with the Parameters block", () => {
    const doc: string = docs.findPME("SurveyModel", "onValueChanged").documentation;
    expect(doc).not.toContain("For information on event handler parameters");
    expect(doc).toContain("Parameters:");
    expect(doc).toContain("- `options.allowCancel`: `boolean`");
  });
});
