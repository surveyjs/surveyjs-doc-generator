import { describe, test, expect, beforeAll } from "vitest";
import { runDocGenerator, DocsResult } from "./helper";

describe("jsdoc tags", () => {
  let docs: DocsResult;
  beforeAll(() => {
    docs = runDocGenerator("tags");
  });

  test("@title and @description set class meta info", () => {
    const cls = docs.findClass("ElementBase");
    expect(cls.metaTitle).toBe("Base Element");
    expect(cls.metaDescription).toBe("The base element meta description.");
  });

  test("@hidden marks the member as hidden", () => {
    expect(docs.findPME("ElementBase", "internalId").isHidden).toBe(true);
  });

  test("@hidden member is propagated to descendant classes as a hidden entry", () => {
    const entry = docs.findPME("TextElement", "internalId");
    expect(entry).toBeDefined();
    expect(entry.isHidden).toBe(true);
    expect(entry.documentation).toBe("");
    expect(docs.findMember("TextElement", "internalId")).toBeDefined();
  });

  test("@hidefor fills hideForClasses and adds a hidden entry to the listed class", () => {
    expect(docs.findPME("ElementBase", "width").hideForClasses).toEqual(["TextElement"]);
    const hidden = docs.findPME("TextElement", "width");
    expect(hidden).toBeDefined();
    expect(hidden.isHidden).toBe(true);
  });

  test("@deprecated sets isDeprecated and prefixes the info with Obsolete", () => {
    const prop = docs.findPME("ElementBase", "widthValue");
    expect(prop.isDeprecated).toBe(true);
    expect(prop.deprecationInfo).toBe("Obsolete. Use the width property instead.");
  });

  test("@see tags are collected", () => {
    // TypeScript 4.2 includes the next jsdoc line's "*" in the tag text
    // when @see is not the last line of the comment.
    expect(docs.findPME("ElementBase", "name").see).toEqual(["width *", "widthValue"]);
  });
});
