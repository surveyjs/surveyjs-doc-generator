import { vi } from "vitest";
import * as path from "path";

// The generator writes its results with fs.writeFileSync into hard-coded
// paths (process.cwd() + "/docs/*.json"). Replace writeFileSync with a
// version that records the content in memory while a test is running
// (tests/helper.ts sets globalThis.__writtenFiles around each run).
// All other fs functions stay real: the generator reads fixture files from disk.
vi.mock("fs", async (importOriginal) => {
  const actual: any = await importOriginal();
  const writeFileSync = vi.fn((file: any, data: any): void => {
    const store = (globalThis as any).__writtenFiles;
    if (store) {
      // The full paths are recorded separately, for tests that assert where a file lands.
      const paths = (globalThis as any).__writtenPaths;
      if (paths) paths.push(file.toString());
      store[path.basename(file.toString())] = data.toString();
      return;
    }
    actual.writeFileSync(file, data);
  });
  // generateMDFiles creates the docs/api directory before writing. While a
  // capture is active, skip touching the real filesystem.
  const mkdirSync = vi.fn((dir: any, opts?: any): any => {
    const store = (globalThis as any).__writtenFiles;
    if (store) return undefined;
    return actual.mkdirSync(dir, opts);
  });
  return {
    ...actual,
    writeFileSync: writeFileSync,
    mkdirSync: mkdirSync,
    default: { ...actual, writeFileSync: writeFileSync, mkdirSync: mkdirSync }
  };
});
