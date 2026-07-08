import { describe, test, expect, beforeAll } from "vitest";
import { runDocGenerator, runMDGenerator, runFullGenerator, DocsResult } from "./helper";
import { detectProduct } from "../src/md-generator";

describe("generateMDFiles", () => {
  describe("class file (smoke fixture)", () => {
    let files: { [name: string]: string };
    let md: string;
    beforeAll(() => {
      const docs = runDocGenerator("smoke");
      files = runMDGenerator(docs.classes, docs.pmes);
      md = files["SimpleModel.md"];
    });

    test("a file is generated per documented class, named <ClassName>.md", () => {
      expect(files["SimpleModel.md"]).toBeDefined();
    });

    test("undocumented classes do not produce a file", () => {
      expect(files["NotDocumented.md"]).toBeUndefined();
    });

    test("front matter carries the title, product and api-type", () => {
      expect(md).toContain("---\n");
      expect(md).toContain("title: SimpleModel");
      expect(md).toContain("product: Form Library");
      expect(md).toContain("api-type: class");
    });

    test("heading and class description are rendered", () => {
      expect(md).toContain("# `SimpleModel`");
      expect(md).toContain("A simple model class.");
    });

    test("properties are listed with description and type", () => {
      expect(md).toContain("## Properties");
      expect(md).toContain("### `title`");
      expect(md).toContain("The model title.");
      expect(md).toContain("**Type**: `string`");
    });

    test("methods are listed with return value and a parameters table", () => {
      expect(md).toContain("## Methods");
      expect(md).toContain("### `greet()`");
      expect(md).toContain("Returns a greeting for the specified name.");
      expect(md).toContain("**Return value:** `string` &ndash; The greeting text.");
      expect(md).toContain("**Parameters:**");
      expect(md).toContain("| `name` | `string` | A person name. |");
    });
  });

  describe("interface file (members fixture)", () => {
    let files: { [name: string]: string };
    beforeAll(() => {
      const docs = runDocGenerator("members");
      files = runMDGenerator(docs.classes, docs.pmes);
    });

    test("an interface produces a <InterfaceName>.md file marked api-type: interface", () => {
      const md = files["IPanel.md"];
      expect(md).toBeDefined();
      expect(md).toContain("api-type: interface");
      expect(md).toContain("# `IPanel`");
      expect(md).toContain("### `name`");
      expect(md).toContain("### `description`");
    });

    test("a class with different member kinds is rendered", () => {
      const md = files["MemberKinds.md"];
      expect(md).toBeDefined();
      expect(md).toContain("api-type: class");
      expect(md).toContain("### `readOnlyValue`");
      expect(md).toContain("### `calculate()`");
    });
  });

  describe("inheritance chain (inheritance fixture)", () => {
    test("the Inheritance section lists base types from the root down to the class", () => {
      const docs = runDocGenerator("inheritance");
      const files = runMDGenerator(docs.classes, docs.pmes);
      const md = files["QuestionText.md"];
      expect(md).toContain("## Inheritance");
      expect(md).toContain("`Base` &rarr; `Question` &rarr; `QuestionText`");
    });

    test("a root class without a base type has no Inheritance section", () => {
      const docs = runDocGenerator("inheritance");
      const files = runMDGenerator(docs.classes, docs.pmes);
      expect(files["Base.md"]).not.toContain("## Inheritance");
    });
  });

  describe("events (events fixture)", () => {
    test("events are rendered under an Events section with their documentation", () => {
      const docs = runDocGenerator("events");
      const files = runMDGenerator(docs.classes, docs.pmes);
      const md = files["SurveyModel.md"];
      expect(md).toContain("## Events");
      expect(md).toContain("### `onComplete`");
      expect(md).toContain("An event raised when the survey is completed.");
      // The event documentation already carries the resolved parameter list.
      expect(md).toContain("- `options.data`: `any`");
    });
  });

  describe("options", () => {
    test("the product name can be overridden", () => {
      const docs = runDocGenerator("smoke");
      const files = runMDGenerator(docs.classes, docs.pmes, { product: "Survey Creator" });
      expect(files["SimpleModel.md"]).toContain("product: Survey Creator");
    });
  });

  describe("generateDocumentation integration", () => {
    test("generateMDFiles: true writes Markdown and skips the JSON files", () => {
      const files = runFullGenerator("smoke", { generateMDFiles: true });
      expect(files["SimpleModel.md"]).toBeDefined();
      expect(files["classes.json"]).toBeUndefined();
      expect(files["pmes.json"]).toBeUndefined();
    });

    test("without generateMDFiles the JSON files are written and no Markdown", () => {
      const files = runFullGenerator("smoke", { generateDoc: true });
      expect(files["classes.json"]).toBeDefined();
      expect(files["pmes.json"]).toBeDefined();
      expect(files["SimpleModel.md"]).toBeUndefined();
    });
  });

  describe("product detection", () => {
    test("defaults to Form Library when nothing matches", () => {
      expect(detectProduct(["entries/chunks/model.ts"])).toBe("Form Library");
      expect(detectProduct([])).toBe("Form Library");
      expect(detectProduct(undefined)).toBe("Form Library");
    });

    test("detects the PDF Generator from the entry path", () => {
      expect(detectProduct(["src/entries/pdf.ts"])).toBe("PDF Generator");
    });

    test("detects the PDF Generator with Windows-style separators", () => {
      expect(detectProduct(["src\\entries\\pdf.ts"])).toBe("PDF Generator");
    });

    test("detects Survey Creator from the working directory", () => {
      expect(detectProduct(["src/entries/index.ts"], "c:/survey.js/Lib/survey-creator")).toBe("Survey Creator");
    });

    test("detects the Dashboard from analytics/dashboard paths", () => {
      expect(detectProduct(["src/entries/analytics.ts"])).toBe("Dashboard");
      expect(detectProduct(["src/dashboard.ts"])).toBe("Dashboard");
    });

    test("generateMDFiles derives the product from options.fileNames", () => {
      const docs = runDocGenerator("smoke");
      const files = runMDGenerator(docs.classes, docs.pmes, { fileNames: ["src/entries/pdf.ts"] });
      expect(files["SimpleModel.md"]).toContain("product: PDF Generator");
    });

    test("an explicit product option wins over detection", () => {
      const docs = runDocGenerator("smoke");
      const files = runMDGenerator(docs.classes, docs.pmes, {
        product: "Form Library", fileNames: ["src/entries/pdf.ts"]
      });
      expect(files["SimpleModel.md"]).toContain("product: Form Library");
    });
  });
});
