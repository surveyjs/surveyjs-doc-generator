import { describe, test, expect, beforeAll } from "vitest";
import { runDocGenerator, DocsResult } from "./helper";

describe("basic documentation generation", () => {
  let docs: DocsResult;
  beforeAll(() => {
    docs = runDocGenerator("smoke");
  });

  test("documented class is included with its documentation", () => {
    const cls = docs.findClass("SimpleModel");
    expect(cls).toBeDefined();
    expect(cls.documentation).toBe("A simple model class.");
    expect(cls.entryType).toBe(1); // DocEntryType.classType
  });

  test("class without doc comments is excluded", () => {
    expect(docs.findClass("NotDocumented")).toBeUndefined();
    expect(docs.filterPMEs("NotDocumented")).toHaveLength(0);
  });

  test("class is not duplicated in the output", () => {
    expect(docs.classes.filter((c: any) => c.name === "SimpleModel")).toHaveLength(1);
    expect(docs.filterPMEs("SimpleModel", "title")).toHaveLength(1);
  });

  test("property member is serialized", () => {
    const prop = docs.findPME("SimpleModel", "title");
    expect(prop).toBeDefined();
    expect(prop.pmeType).toBe("property");
    expect(prop.type).toBe("string");
    expect(prop.isField).toBe(true);
    expect(prop.documentation).toBe("The model title.");
  });

  test("method member is serialized with parameters and return info", () => {
    const method = docs.findPME("SimpleModel", "greet");
    expect(method).toBeDefined();
    expect(method.pmeType).toBe("method");
    expect(method.returnType).toBe("string");
    expect(method.returnDocumentation).toBe("The greeting text.");
    expect(method.parameters).toHaveLength(1);
    expect(method.parameters[0].name).toBe("name");
    expect(method.parameters[0].type).toBe("string");
    expect(method.parameters[0].documentation).toBe("A person name.");
  });

  test("members are attached to the class entry", () => {
    expect(docs.findMember("SimpleModel", "title")).toBeDefined();
    expect(docs.findMember("SimpleModel", "greet")).toBeDefined();
  });
});
