import * as fs from "fs";
import * as path from "path";
import { DocEntry, DocEntryType } from "./types";
import { ensureDir } from "./file-utils";

export interface MDGenerationOptions {
  /**
   * Product name written into the `product` front-matter field. When omitted it
   * is inferred from `fileNames`/the working directory (see detectProduct),
   * falling back to "Form Library".
   */
  product?: string;
  /** Entry file paths used to auto-detect the product when `product` is not set. */
  fileNames?: string[];
  /**
   * Target directory for the generated files, absolute or relative to the working
   * directory. Defaults to `<cwd>/docs/api`.
   */
  outputDir?: string;
  /** Value written into the `source` front-matter field (e.g. a base URL to the sources). */
  sourceBaseUrl?: string;
}

/** Keyword rules mapping an entry path (or working directory) to a product name. */
const productRules: { product: string; keywords: string[] }[] = [
  { product: "PDF Generator", keywords: ["pdf"] },
  { product: "Survey Creator", keywords: ["creator"] },
  { product: "Dashboard", keywords: ["dashboard", "analytics"] }
];

/**
 * Infers the product name from the entry file paths (and optionally the working
 * directory), e.g. `src/entries/pdf.ts` &rarr; "PDF Generator". Falls back to
 * "Form Library" when nothing matches.
 */
export function detectProduct(fileNames?: string[], cwd?: string): string {
  const parts: string[] = [];
  if (Array.isArray(fileNames)) parts.push(...fileNames);
  if (cwd) parts.push(cwd);
  const haystack = parts.join(" ").replace(/\\/g, "/").toLowerCase();
  for (let i = 0; i < productRules.length; i++) {
    const rule = productRules[i];
    if (rule.keywords.some((k) => haystack.indexOf(k) > -1)) return rule.product;
  }
  return "Form Library";
}

/** Product name &rarr; the library slug used in surveyjs.io documentation URLs. */
const libraryNames: { [product: string]: string } = {
  "Form Library": "form-library",
  "Survey Creator": "survey-creator",
  "Dashboard": "dashboard",
  "PDF Generator": "pdf-generator"
};

/**
 * Builds the `source` front-matter URL, e.g.
 * `https://surveyjs.io/form-library/documentation/api-reference/surveymodel`.
 */
export function sourceUrl(product: string, className: string, baseUrl?: string): string {
  const base = (baseUrl || "https://surveyjs.io").replace(/\/+$/, "");
  const library = libraryNames[product] || libraryNames["Form Library"];
  return base + "/" + library + "/documentation/api-reference/" + (className || "").toLowerCase();
}

/**
 * Generates one Markdown file per documented class/interface following the
 * API-reference template. Files are named `<ClassName>.md` / `<InterfaceName>.md`
 * and written into `docs/api` (created when missing).
 *
 * @param classes The `outputClasses` produced by generateDocumentation (docs/classes.json).
 * @param pmes The `outputPMEs` produced by generateDocumentation (docs/pmes.json).
 * @param options Optional generation settings.
 */
export function generateMDFiles(
  classes: DocEntry[], pmes: DocEntry[], options: MDGenerationOptions = {}
): void {
  if (!Array.isArray(classes)) return;
  const members = Array.isArray(pmes) ? pmes : [];
  const outputDir = ensureDir(options.outputDir || path.join(process.cwd(), "docs", "api"));
  const product = options.product || detectProduct(options.fileNames, process.cwd());
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];
    if (!isClassOrInterface(cls) || !cls.name || !hasDescription(cls)) continue;
    const content = generateMDForClass(cls, members, product, options.sourceBaseUrl);
    fs.writeFileSync(path.join(outputDir, cls.name + ".md"), content);
  }
  fs.writeFileSync(
    path.join(outputDir, "index.md"),
    generateIndexMD(classes, members, product, options.sourceBaseUrl)
  );
}

/**
 * Builds the content of `index.md`: a list of documented classes (interfaces
 * excluded), each shown as a link to the class API-reference page plus the
 * first sentence of its description. Classes are ordered by the number of API
 * members they expose, most members first (e.g. `SurveyModel` leads the list).
 */
export function generateIndexMD(
  classes: DocEntry[], pmes: DocEntry[], product: string = "Form Library", sourceBaseUrl?: string
): string {
  const members = Array.isArray(pmes) ? pmes : [];
  const entries = (Array.isArray(classes) ? classes : [])
    .filter((cls) => !!cls && cls.entryType === DocEntryType.classType
      && !!cls.name && hasDescription(cls))
    .map((cls) => ({
      name: cls.name,
      sentence: firstSentence(stripMarkdownLinks(cls.documentation)),
      count: members.filter((p) => p.className === cls.name && isVisibleMember(p)).length
    }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
  const lines = ["---", "title: Classes", "---", "", "# Classes", ""];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const link = "[`" + entry.name + "`](" + sourceUrl(product, entry.name, sourceBaseUrl) + ".md)";
    lines.push("- " + link + (entry.sentence ? " — " + entry.sentence : ""));
  }
  return lines.join("\n") + "\n";
}

/** True when the entry has a non-empty description. */
function hasDescription(cls: DocEntry): boolean {
  return !!cls && !!(cls.documentation || "").trim();
}

/** Replaces Markdown links `[label](url)` with just their `label`. */
function stripMarkdownLinks(text: any): string {
  if (!text) return "";
  return String(text).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

/** Returns the first sentence (up to the first `.`/`!`/`?`) of a text. */
function firstSentence(text: any): string {
  const line = oneLine(text);
  if (!line) return "";
  const match = line.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : line;
}

function isClassOrInterface(cls: DocEntry): boolean {
  return !!cls
    && (cls.entryType === DocEntryType.classType || cls.entryType === DocEntryType.interfaceType);
}

/** Builds the Markdown content for a single class/interface. */
export function generateMDForClass(
  cls: DocEntry, pmes: DocEntry[], product: string, sourceBaseUrl?: string
): string {
  const isInterface = cls.entryType === DocEntryType.interfaceType;
  const members = pmes
    .filter((p) => p.className === cls.name && isVisibleMember(p))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const properties = members.filter((p) => p.pmeType === "property");
  const methods = members.filter((p) => p.pmeType === "method");
  const events = members.filter((p) => p.pmeType === "event");

  const parts: string[] = [];
  parts.push(frontMatter(cls, product, isInterface, sourceBaseUrl));
  parts.push("# `" + cls.name + "`");
  const description = (cls.documentation || "").trim();
  if (description) parts.push(description);
  const inheritance = inheritanceSection(cls);
  if (inheritance) parts.push(inheritance);
  if (properties.length > 0) parts.push(propertiesSection(properties));
  if (methods.length > 0) parts.push(methodsSection(methods));
  if (events.length > 0) parts.push(eventsSection(events));
  return parts.join("\n\n") + "\n";
}

function isVisibleMember(member: DocEntry): boolean {
  return member.isHidden !== true && member.isProtected !== true && hasDescription(member);
}

function frontMatter(
  cls: DocEntry, product: string, isInterface: boolean, sourceBaseUrl?: string
): string {
  const title = cls.metaTitle || cls.name || "";
  const description = firstSentence(stripMarkdownLinks(cls.metaDescription || cls.documentation));
  const source = sourceUrl(product, cls.name, sourceBaseUrl);
  const lines = [
    "---",
    "title: " + yamlScalar(title),
    "product: " + yamlScalar(product),
    "api-type: " + (isInterface ? "interface" : "class"),
    "description: " + yamlScalar(description),
    "source: " + yamlScalar(source),
    "---"
  ];
  return lines.join("\n");
}

function inheritanceSection(cls: DocEntry): string {
  const all = Array.isArray(cls.allTypes) && cls.allTypes.length > 0 ? cls.allTypes : [cls.name];
  if (all.length <= 1) return "";
  const chain = all.slice().reverse().map((t) => "`" + t + "`").join(" &rarr; ");
  return "## Inheritance\n\n" + chain;
}

function propertiesSection(properties: DocEntry[]): string {
  const blocks = properties.map((prop) => {
    // Order: name (heading), type, description.
    const lines = ["### `" + prop.name + "`"];
    lines.push("**Type**: `" + typeString(prop.type, prop.returnTypeGenerics) + "`");
    const doc = (prop.documentation || "").trim();
    if (doc) lines.push(doc);
    return lines.join("\n\n");
  });
  return "## Properties\n\n" + blocks.join("\n\n");
}

function methodsSection(methods: DocEntry[]): string {
  const blocks = methods.map((method) => {
    // Order: name (heading), type (return value), description, then parameters.
    const lines = ["### `" + method.name + "()`"];
    const returnValue = returnValueLine(method);
    if (returnValue) lines.push(returnValue);
    const doc = (method.documentation || "").trim();
    if (doc) lines.push(doc);
    const table = parametersTable(method.parameters);
    if (table) lines.push("**Parameters:**\n\n" + table);
    return lines.join("\n\n");
  });
  return "## Methods\n\n" + blocks.join("\n\n");
}

function eventsSection(events: DocEntry[]): string {
  const blocks = events.map((event) => {
    const lines = ["### `" + event.name + "`"];
    const doc = (event.documentation || "").trim();
    if (doc) lines.push(doc);
    return lines.join("\n\n");
  });
  return "## Events\n\n" + blocks.join("\n\n");
}

function returnValueLine(method: DocEntry): string {
  const type = typeString(method.returnType, method.returnTypeGenerics);
  if (!type || type === "void") return "";
  const returnDoc = oneLine(method.returnDocumentation);
  let line = "**Return value:** `" + type + "`";
  if (returnDoc) line += " &ndash; " + returnDoc;
  return line;
}

function parametersTable(parameters: DocEntry[]): string {
  if (!Array.isArray(parameters) || parameters.length === 0) return "";
  const rows = [
    "| Name | Type | Description |",
    "| ---- | ---- | ----------- |"
  ];
  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    rows.push(
      "| `" + tableCell(param.name) + "` | `" + tableCell(param.type) + "` | "
      + tableCell(param.documentation) + " |"
    );
  }
  return rows.join("\n");
}

function typeString(type: string, generics?: string[]): string {
  const base = type || "any";
  if (Array.isArray(generics) && generics.length > 0) {
    return base + "<" + generics.join(", ") + ">";
  }
  return base;
}

/** Collapses whitespace/newlines into a single line. */
function oneLine(text: any): string {
  if (!text) return "";
  return String(text).replace(/\s+/g, " ").trim();
}

/** Escapes a value for use inside a Markdown table cell. */
function tableCell(text: any): string {
  return oneLine(text).replace(/\|/g, "\\|");
}

/** Produces a YAML-safe scalar, quoting only when the value needs it. */
function yamlScalar(value: string): string {
  const text = oneLine(value);
  if (text === "") return "";
  const needsQuoting =
    /:(\s|$)/.test(text)                    // colon that ends a token (a mapping key)
    || /\s#/.test(text)                     // start of a comment
    || /["\\]/.test(text)                   // quote or backslash
    || /^[-?:,\[\]{}#&*!|>'"%@`]/.test(text); // leading YAML indicator
  if (needsQuoting) {
    return "\"" + text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"";
  }
  return text;
}
