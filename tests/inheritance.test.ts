import { describe, test, expect, beforeAll } from "vitest";
import { runDocGenerator, DocsResult } from "./helper";

describe("class inheritance", () => {
  let docs: DocsResult;
  beforeAll(() => {
    docs = runDocGenerator("inheritance");
  });

  test("baseType is set from the extends clause", () => {
    expect(docs.findClass("Base").baseType).toBe("");
    expect(docs.findClass("Question").baseType).toBe("Base");
    expect(docs.findClass("QuestionText").baseType).toBe("Question");
  });

  test("allTypes contains the whole inheritance chain", () => {
    expect(docs.findClass("Base").allTypes).toEqual(["Base"]);
    expect(docs.findClass("Question").allTypes).toEqual(["Question", "Base"]);
    expect(docs.findClass("QuestionText").allTypes).toEqual(["QuestionText", "Question", "Base"]);
  });

  test("jsonName is extracted from getType()", () => {
    expect(docs.findClass("Base").jsonName).toBe("base");
    expect(docs.findClass("Question").jsonName).toBe("question");
    expect(docs.findClass("QuestionText").jsonName).toBe("text");
  });
});
