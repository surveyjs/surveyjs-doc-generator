import * as ts from "typescript";
export declare function setJsonObj(obj: any): void;
/** Generate documentation for all classes in a set of .ts files */
export declare function generateDocumentation(fileNames: string[], options: ts.CompilerOptions, docOptions?: any): void;
