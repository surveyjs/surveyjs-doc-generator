import { describe, test, expect, beforeAll } from "vitest";
import { runDocGenerator, DocsResult } from "./helper";

// A minimal stand-in for the survey-core Serializer that is normally passed
// to setJsonObj. Property objects are shared by reference on purpose: the
// generator compares them by identity to detect where a property is declared.
function createFakeSerializer() {
  const titleLocationProp = { name: "titleLocation", defaultValue: "top", choices: ["top", "bottom", "left"] };
  const nameProp = { name: "name" };
  const choicesProp = { name: "choices", className: "itemvalue" };
  const htmlProp = { name: "html", isSerializable: false };
  const htmlTitleLocationProp = { name: "titleLocation", visible: false };

  const classes: any = {
    question: { name: "question", properties: [titleLocationProp, nameProp, choicesProp] },
    html: { name: "html", parentName: "question", properties: [htmlTitleLocationProp, htmlProp] }
  };
  return {
    findClass: (name: string) => classes[name],
    getProperties: (name: string) => (classes[name] ? classes[name].properties : []),
    findProperty: (className: string, propName: string) => {
      const cls = classes[className];
      if (!cls) return undefined;
      return cls.properties.find((p: any) => p.name === propName);
    }
  };
}

describe("serializer metadata integration (setJsonObj)", () => {
  let docs: DocsResult;
  beforeAll(() => {
    docs = runDocGenerator("serializer", createFakeSerializer());
  });

  test("serialized property gets isSerialized, defaultValue and serializedChoices", () => {
    const prop = docs.findPME("Question", "titleLocation");
    expect(prop.isSerialized).toBe(true);
    expect(prop.defaultValue).toBe("top");
    expect(prop.serializedChoices).toEqual(["top", "bottom", "left"]);
  });

  test("property with isSerializable: false gets isSerialized: false", () => {
    expect(docs.findPME("QuestionHtml", "html").isSerialized).toBe(false);
    expect(docs.findPME("Question", "name").isSerialized).toBe(true);
  });

  test("property className is exposed as jsonClassName", () => {
    expect(docs.findPME("Question", "choices").jsonClassName).toBe("itemvalue");
  });

  test("property hidden in a descendant via visible: false fills hideForClasses", () => {
    expect(docs.findPME("Question", "titleLocation").hideForClasses).toEqual(["QuestionHtml"]);
  });

  test("a hidden copy of the property is added to the hiding class", () => {
    const hidden = docs.findPME("QuestionHtml", "titleLocation");
    expect(hidden).toBeDefined();
    expect(hidden.isHidden).toBe(true);
    expect(hidden.documentation).toBe("");
    expect(docs.findMember("QuestionHtml", "titleLocation")).toBeDefined();
  });
});
