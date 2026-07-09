import { generateDocumentation, setJsonObj, generateMDFiles } from "../index.ts";

export interface DocsResult {
  classes: any[];
  pmes: any[];
  findClass(name: string): any;
  findMember(className: string, memberName: string): any;
  findPME(className: string, name: string): any;
  filterPMEs(className: string, name?: string): any[];
}

/**
 * Runs generateDocumentation on tests/fixtures/<fixtureName>.entry.ts and
 * returns the parsed content of docs/classes.json and docs/pmes.json.
 *
 * The generator writes results via fs.writeFileSync into hard-coded paths;
 * tests/setup.ts mocks writeFileSync to record the content into
 * globalThis.__writtenFiles instead of writing to disk.
 *
 * Fixtures are referenced through a one-line `export * from "./<name>";`
 * entry file because generateDocumentation visits entry files twice (once in
 * the all-source-files loop and once in the explicit entries loop), which
 * duplicates every class declared directly inside an entry file.
 */
export function runDocGenerator(fixtureName: string, jsonObj: any = null): DocsResult {
  const entryFile = "tests/fixtures/" + fixtureName + ".entry.ts";
  const written: { [name: string]: string } = {};
  (globalThis as any).__writtenFiles = written;
  try {
    setJsonObj(jsonObj);
    generateDocumentation([entryFile], {}, { generateDoc: true });
  } finally {
    (globalThis as any).__writtenFiles = undefined;
    setJsonObj(null);
  }
  const classes = JSON.parse(written["classes.json"] || "[]");
  const pmes = JSON.parse(written["pmes.json"] || "[]");
  return {
    classes: classes,
    pmes: pmes,
    findClass: (name: string) => classes.find((c: any) => c.name === name),
    findMember: (className: string, memberName: string) => {
      const cls = classes.find((c: any) => c.name === className);
      if (!cls || !Array.isArray(cls.members)) return undefined;
      return cls.members.find((m: any) => m.name === memberName);
    },
    findPME: (className: string, name: string) =>
      pmes.find((p: any) => p.className === className && p.name === name),
    filterPMEs: (className: string, name?: string) =>
      pmes.filter((p: any) => p.className === className && (!name || p.name === name))
  };
}

/**
 * Runs generateMDFiles on the supplied classes/pmes and returns a map of the
 * generated markdown keyed by file name (e.g. "SimpleModel.md").
 *
 * Reuses the same fs.writeFileSync mock as runDocGenerator (see tests/setup.ts):
 * the content is recorded in memory instead of being written to docs/api.
 */
export function runMDGenerator(
  classes: any[], pmes: any[], options: any = {}
): { [fileName: string]: string } {
  const written: { [name: string]: string } = {};
  (globalThis as any).__writtenFiles = written;
  try {
    generateMDFiles(classes, pmes, options);
  } finally {
    (globalThis as any).__writtenFiles = undefined;
  }
  return written;
}

/** Full paths of the files written by the last runFullGenerator call. */
export const lastWrittenPaths: string[] = [];

/**
 * Runs the full generateDocumentation pipeline on a fixture and returns every
 * file it wrote, keyed by base name (e.g. "classes.json", "SimpleModel.md").
 * Use this to assert which artifacts a given set of docOptions produces; the
 * directories they were written into are available in lastWrittenPaths.
 */
export function runFullGenerator(
  fixtureName: string, docOptions: any = {}
): { [fileName: string]: string } {
  const entryFile = "tests/fixtures/" + fixtureName + ".entry.ts";
  const written: { [name: string]: string } = {};
  (globalThis as any).__writtenFiles = written;
  lastWrittenPaths.length = 0;
  (globalThis as any).__writtenPaths = lastWrittenPaths;
  try {
    generateDocumentation([entryFile], {}, docOptions);
  } finally {
    (globalThis as any).__writtenFiles = undefined;
    (globalThis as any).__writtenPaths = undefined;
  }
  return written;
}
