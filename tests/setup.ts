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
      store[path.basename(file.toString())] = data.toString();
      return;
    }
    actual.writeFileSync(file, data);
  });
  return {
    ...actual,
    writeFileSync: writeFileSync,
    default: { ...actual, writeFileSync: writeFileSync }
  };
});
