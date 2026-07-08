import { describe, test, expect, beforeAll } from "vitest";
import { runDocGenerator, runMDGenerator, runFullGenerator, DocsResult } from "./helper";
import { detectProduct, generateIndexMD, sourceUrl } from "../src/md-generator";

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

    test("classes and interfaces without a description do not produce a file", () => {
      const classes = [
        { name: "Documented", entryType: 1, documentation: "A documented class." },
        { name: "NoDocClass", entryType: 1, documentation: "   " },
        { name: "IDocumented", entryType: 2, documentation: "A documented interface." },
        { name: "INoDocIface", entryType: 2, documentation: "" }
      ];
      const out = runMDGenerator(classes as any, []);
      expect(out["Documented.md"]).toBeDefined();
      expect(out["IDocumented.md"]).toBeDefined();
      expect(out["NoDocClass.md"]).toBeUndefined();
      expect(out["INoDocIface.md"]).toBeUndefined();
    });

    test("front matter carries the title, product and api-type", () => {
      expect(md).toContain("---\n");
      expect(md).toContain("title: SimpleModel");
      expect(md).toContain("product: Form Library");
      expect(md).toContain("api-type: class");
    });

    test("front matter carries the source URL, unquoted", () => {
      expect(md).toContain("source: https://surveyjs.io/form-library/documentation/api-reference/simplemodel");
    });

    test("front matter description is only the first sentence, without links", () => {
      const classes = [{
        name: "EmailValidator", entryType: 1,
        documentation: "A class that implements a validator for e-mail addresses. [View Demo](https://surveyjs.io/form-library/examples/javascript-form-validation/ (linkStyle))"
      }];
      const out = runMDGenerator(classes as any, [])["EmailValidator.md"];
      // Inspect only the front-matter block; the body keeps the full documentation.
      const frontMatter = out.split("---")[1];
      expect(frontMatter).toContain("description: A class that implements a validator for e-mail addresses.");
      expect(frontMatter).not.toContain("View Demo");
      expect(frontMatter).not.toContain("](");
      expect(frontMatter).not.toContain("https://surveyjs.io/form-library/examples");
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

    test("members within a section are listed in alphabetical order", () => {
      const classes = [{ name: "Sample", entryType: 1, documentation: "A sample class." }];
      const pmes = [
        { className: "Sample", name: "zebra", pmeType: "property", type: "string", documentation: "Z prop." },
        { className: "Sample", name: "apple", pmeType: "property", type: "string", documentation: "A prop." },
        { className: "Sample", name: "mango", pmeType: "property", type: "string", documentation: "M prop." },
        { className: "Sample", name: "run", pmeType: "method", returnType: "void", documentation: "R method." },
        { className: "Sample", name: "brake", pmeType: "method", returnType: "void", documentation: "B method." }
      ];
      const md = runMDGenerator(classes as any, pmes as any)["Sample.md"];
      expect(md.indexOf("`apple`")).toBeLessThan(md.indexOf("`mango`"));
      expect(md.indexOf("`mango`")).toBeLessThan(md.indexOf("`zebra`"));
      expect(md.indexOf("`brake()`")).toBeLessThan(md.indexOf("`run()`"));
    });

    test("members without a description are not rendered", () => {
      const classes = [{ name: "Sample", entryType: 1, documentation: "A sample class." }];
      const pmes = [
        { className: "Sample", name: "documentedProp", pmeType: "property", type: "string", documentation: "A documented property." },
        { className: "Sample", name: "silentProp", pmeType: "property", type: "string", documentation: "" },
        { className: "Sample", name: "documentedMethod", pmeType: "method", returnType: "void", documentation: "A documented method." },
        { className: "Sample", name: "silentMethod", pmeType: "method", returnType: "void", documentation: "   " }
      ];
      const md = runMDGenerator(classes as any, pmes as any)["Sample.md"];
      expect(md).toContain("### `documentedProp`");
      expect(md).toContain("### `documentedMethod()`");
      expect(md).not.toContain("silentProp");
      expect(md).not.toContain("silentMethod");
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

  describe("index file", () => {
    // Hand-built entries give full control over member counts and descriptions.
    const classes = [
      { name: "SmallHelper", entryType: 1, documentation: "A small helper class. Extra sentence here." },
      { name: "SurveyModel", entryType: 1, documentation: "The main survey model. It does a lot of things." },
      { name: "MidClass", entryType: 1, documentation: "A mid-sized class. Second sentence." },
      { name: "NoDescription", entryType: 1, documentation: "   " },
      { name: "IPanel", entryType: 2, documentation: "A panel interface. Should be excluded." }
    ];
    const pmes = [
      { className: "SurveyModel", name: "a", pmeType: "property", documentation: "Prop a." },
      { className: "SurveyModel", name: "b", pmeType: "property", documentation: "Prop b." },
      { className: "SurveyModel", name: "c", pmeType: "method", documentation: "Method c." },
      { className: "MidClass", name: "m1", pmeType: "property", documentation: "Prop m1." },
      { className: "MidClass", name: "m2", pmeType: "property", documentation: "Prop m2." },
      { className: "SmallHelper", name: "x", pmeType: "property", documentation: "Prop x." },
      { className: "IPanel", name: "name", pmeType: "property", documentation: "Name." }
    ];
    const md = generateIndexMD(classes as any, pmes as any);

    test("lists a class with only the first sentence of its description", () => {
      expect(md).toContain("`SurveyModel`");
      expect(md).toContain("The main survey model.");
      expect(md).not.toContain("It does a lot of things.");
      expect(md).toContain("A small helper class.");
      expect(md).not.toContain("Extra sentence here.");
    });

    test("classes are ordered by API member count, most members first", () => {
      const posSurvey = md.indexOf("SurveyModel");
      const posMid = md.indexOf("MidClass");
      const posSmall = md.indexOf("SmallHelper");
      expect(posSurvey).toBeGreaterThan(-1);
      expect(posSurvey).toBeLessThan(posMid);
      expect(posMid).toBeLessThan(posSmall);
    });

    test("interfaces are not listed", () => {
      expect(md).not.toContain("IPanel");
    });

    test("classes without a description are not listed", () => {
      expect(md).not.toContain("NoDescription");
    });

    test("each class name is a link to its api-reference page", () => {
      expect(md).toContain(
        "- [`SurveyModel`](https://surveyjs.io/form-library/documentation/api-reference/surveymodel.md) — The main survey model."
      );
    });

    test("the link uses the given product's library slug", () => {
      const out = generateIndexMD(classes as any, pmes as any, "Survey Creator");
      expect(out).toContain("(https://surveyjs.io/survey-creator/documentation/api-reference/surveymodel.md)");
    });

    test("the description sentence itself stays link-free", () => {
      const linked = [
        { name: "Linked", entryType: 1, documentation: "See the [`PanelModel`](https://example.com/panel) class for details." }
      ];
      const line = generateIndexMD(linked as any, [])
        .split("\n").find((l) => l.indexOf("Linked") > -1) || "";
      const sentence = line.split(" — ")[1] || "";
      expect(sentence).toBe("See the `PanelModel` class for details.");
      expect(sentence).not.toContain("](");
      expect(sentence).not.toContain("https://");
    });

    test("generateMDFiles writes an index.md alongside the class files", () => {
      const docs = runDocGenerator("smoke");
      const files = runMDGenerator(docs.classes, docs.pmes);
      expect(files["index.md"]).toBeDefined();
      expect(files["index.md"]).toContain(
        "[`SimpleModel`](https://surveyjs.io/form-library/documentation/api-reference/simplemodel.md)"
      );
      expect(files["index.md"]).toContain("A simple model class.");
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

  describe("source URL", () => {
    test("maps each product to its library slug and lowercases the class name", () => {
      expect(sourceUrl("Form Library", "SurveyModel"))
        .toBe("https://surveyjs.io/form-library/documentation/api-reference/surveymodel");
      expect(sourceUrl("Survey Creator", "SurveyCreatorModel"))
        .toBe("https://surveyjs.io/survey-creator/documentation/api-reference/surveycreatormodel");
      expect(sourceUrl("Dashboard", "VisualizationPanel"))
        .toBe("https://surveyjs.io/dashboard/documentation/api-reference/visualizationpanel");
      expect(sourceUrl("PDF Generator", "SurveyPDF"))
        .toBe("https://surveyjs.io/pdf-generator/documentation/api-reference/surveypdf");
    });

    test("falls back to the Form Library slug for an unknown product", () => {
      expect(sourceUrl("Unknown", "Foo"))
        .toBe("https://surveyjs.io/form-library/documentation/api-reference/foo");
    });

    test("honours a custom base URL (without a trailing slash)", () => {
      expect(sourceUrl("Form Library", "Foo", "https://example.com/docs/"))
        .toBe("https://example.com/docs/form-library/documentation/api-reference/foo");
    });

    test("the detected/overridden product drives the source URL in the file", () => {
      const docs = runDocGenerator("smoke");
      const files = runMDGenerator(docs.classes, docs.pmes, { product: "PDF Generator" });
      expect(files["SimpleModel.md"])
        .toContain("source: https://surveyjs.io/pdf-generator/documentation/api-reference/simplemodel");
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
