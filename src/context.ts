import * as ts from "typescript";
import { DocEntry } from "./types";

/** Shared mutable state for a single generateDocumentation() run */
export interface GenerationContext {
  checker: ts.TypeChecker;
  outputClasses: DocEntry[];
  outputPMEs: DocEntry[];
  pmesHash: any;
  classesHash: any;
  curClass: DocEntry;
  curJsonName: string;
  generateJSONDefinitionClasses: any;
  generateJSONDefinition: boolean;
  outputDefinition: any;
  vueGeneratedFiles: string[];
}
