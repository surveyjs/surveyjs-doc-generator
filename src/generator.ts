import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import { DocEntry } from "./types";
import { GenerationContext } from "./context";
import { getTsOptions } from "./options";
import { checkFiles, ensureDir } from "./file-utils";
import { generateVueTSFiles, deleteVueTSFiles, isNonEnglishLocalizationFile } from "./vue-files";
import { setAllParentTypes } from "./inheritance";
import { visit } from "./visitor";
import { updateEventsDocumentation, updateHiddenForEntriesDoc } from "./event-docs";
import { addClassIntoJSONDefinition } from "./json-definition";
import { generateMDFiles } from "./md-generator";

/**
 * Generate documentation for all classes in a set of .ts files.
 *
 * `docOptions.outputDir` sets the directory for the generated files. It may be
 * absolute or relative to the working directory and is created when missing.
 * When it is not set, the files go to `<cwd>/docs` (Markdown to `<cwd>/docs/api`).
 */
export function generateDocumentation(
  fileNames: string[], options: ts.CompilerOptions, docOptions: any = {}
): void {
  const ctx: GenerationContext = {
    checker: null,
    outputClasses: <DocEntry[]>[],
    outputPMEs: <DocEntry[]>[],
    pmesHash: {},
    classesHash: {},
    curClass: null,
    curJsonName: null,
    generateJSONDefinitionClasses: {},
    generateJSONDefinition: docOptions.generateJSONDefinition === true,
    outputDefinition: {},
    vueGeneratedFiles: []
  };
  generateVueTSFiles(ctx, fileNames);
  const tsOptions: ts.CompilerOptions = getTsOptions(options);
  if(!checkFiles(fileNames, "File for compiling is not found")) return;
  const host = ts.createCompilerHost(tsOptions);
  // Build a program using the set of root file names in fileNames
  const program = ts.createProgram(fileNames, tsOptions, host);

  // Get the checker, we will use it to find more about classes
  ctx.checker = program.getTypeChecker();
  // Visit every sourceFile in the program
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName.indexOf("node_modules") > 0) continue;
    if(isNonEnglishLocalizationFile(sourceFile.fileName)) continue;
    // Walk the tree to search for classes
    ts.forEachChild(sourceFile, (node: ts.Node) => visit(ctx, node));
  }
  for(var i = 0; i < fileNames.length; i ++) {
    const sourceFile = program.getSourceFile(fileNames[i]);
    if(!!sourceFile) {
      ts.forEachChild(sourceFile, (node: ts.Node) => visit(ctx, node));
    }
  }
  for (var key in ctx.classesHash) {
    setAllParentTypes(ctx, key);
  }
  updateEventsDocumentation(ctx);
  updateHiddenForEntriesDoc(ctx);
  const outputDir = !!docOptions.outputDir
    ? ensureDir(docOptions.outputDir)
    : path.join(process.cwd(), "docs");
  if (docOptions.generateMDFiles === true) {
    // Generate Markdown documentation instead of the intermediate JSON files.
    const mdOptions = Object.assign({ fileNames: fileNames }, docOptions.mdOptions);
    if (!mdOptions.outputDir && !!docOptions.outputDir) mdOptions.outputDir = outputDir;
    generateMDFiles(ctx.outputClasses, ctx.outputPMEs, mdOptions);
  } else {
    // print out the doc
    fs.writeFileSync(
      path.join(outputDir, "classes.json"),
      JSON.stringify(ctx.outputClasses, undefined, 4)
    );
    fs.writeFileSync(
      path.join(outputDir, "pmes.json"),
      JSON.stringify(ctx.outputPMEs, undefined, 4)
    );
  }
  if (ctx.generateJSONDefinition) {
    ctx.outputDefinition["$schema"] = "http://json-schema.org/draft-07/schema#";
    ctx.outputDefinition["title"] = "SurveyJS Library json schema";
    addClassIntoJSONDefinition(ctx, "SurveyModel", true);
    fs.writeFileSync(
      path.join(outputDir, "surveyjs_definition.json"),
      JSON.stringify(ctx.outputDefinition, undefined, 4)
    );
  }
  deleteVueTSFiles(ctx);
}
