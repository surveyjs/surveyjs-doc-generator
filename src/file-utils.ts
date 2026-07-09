import * as fs from "fs";
import * as path from "path";

export function printError(text: string) {
  console.log(text);
}

export function checkFiles(fileNames: string[], errorText: string) {
  if(!Array.isArray(fileNames)) {
    printError("file list is empty");
     return false;
  }
  for(var i = 0; i < fileNames.length; i ++) {
    const absFileName = getAbsoluteFileName(fileNames[i]);
    if(!fs.existsSync(absFileName)) {
      printError(errorText + ": " + absFileName);
      return false;
    }
  }
  return true;
}
export function getAbsoluteFileName(name: string): string {
  return path.join(process.cwd(), name);
}
/** Resolves a directory against the working directory and creates it when missing. */
export function ensureDir(dir: string): string {
  const absDir = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  if (!fs.existsSync(absDir)) {
    fs.mkdirSync(absDir, { recursive: true });
  }
  return absDir;
}
