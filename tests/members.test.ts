import { describe, test, expect, beforeAll } from "vitest";
import { runDocGenerator, DocsResult } from "./helper";

describe("member kinds", () => {
  let docs: DocsResult;
  beforeAll(() => {
    docs = runDocGenerator("members");
  });

  test("getter without setter: hasSet is false", () => {
    const prop = docs.findPME("MemberKinds", "readOnlyValue");
    expect(prop.pmeType).toBe("property");
    expect(prop.isField).toBe(false);
    expect(prop.hasSet).toBe(false);
  });

  test("getter with setter: hasSet is true", () => {
    const prop = docs.findPME("MemberKinds", "value");
    expect(prop.hasSet).toBe(true);
    expect(prop.isField).toBe(false);
  });

  test("static member", () => {
    expect(docs.findPME("MemberKinds", "instanceCounter").isStatic).toBe(true);
  });

  test("protected member", () => {
    expect(docs.findPME("MemberKinds", "internalState").isProtected).toBe(true);
  });

  test("string literal type alias is expanded in the property type", () => {
    const prop = docs.findPME("MemberKinds", "titleLocation");
    expect(prop.type).toBe('"top" | "bottom" | "left"');
  });

  test("localizable property is detected from the @property decorator", () => {
    const prop = docs.findPME("MemberKinds", "text");
    expect(prop.isLocalizable).toBe(true);
    expect(prop.hasSet).toBe(true);
    expect(prop.isField).toBeUndefined();
  });

  test("method with optional parameter", () => {
    const method = docs.findPME("MemberKinds", "calculate");
    expect(method.pmeType).toBe("method");
    expect(method.returnType).toBe("number");
    expect(method.returnDocumentation).toBe("The calculated value.");
    expect(method.parameters).toHaveLength(2);
    expect(method.parameters[0].isOptional).toBe(false);
    expect(method.parameters[1].name).toBe("repeat");
    expect(method.parameters[1].isOptional).toBe(true);
  });

  test("interface is serialized with its members", () => {
    const cls = docs.findClass("IPanel");
    expect(cls).toBeDefined();
    expect(cls.entryType).toBe(2); // DocEntryType.interfaceType
    const name = docs.findPME("IPanel", "name");
    expect(name.isField).toBe(true);
    expect(name.isOptional).toBe(false);
    const description = docs.findPME("IPanel", "description");
    expect(description.isOptional).toBe(true);
  });
});
