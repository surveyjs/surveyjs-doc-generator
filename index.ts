import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const EventDescriptReplacedText = "For information on event handler parameters, refer to descriptions within the interface.";
const SurveyModelSenderDescription = "A survey instance that raised the event.";


enum DocEntryType {unknown, classType, interfaceType, functionType, variableType, enumType};
interface DocEntry {
  name?: string;
  entryType?: DocEntryType;
  className?: string;
  jsonName?: string;
  fileName?: string;
  documentation?: string;
  metaTitle?: string;
  metaDescription?: string;
  see?: any;
  type?: string;
  baseType?: string;
  implements?: string[];
  allTypes?: string[];
  constructors?: DocEntry[];
  members?: DocEntry[];
  parameters?: DocEntry[];
  returnType?: string;
  returnTypeGenerics?: string[];
  typeGenerics?: string[];
  pmeType?: string;
  hasSet?: boolean;
  isField?: boolean;
  isOptional?: boolean;
  isStatic?: boolean;
  isProtected?: boolean;
  isPublic?: boolean;
  isLocalizable?: boolean;
  jsonClassName?: string;
  isSerialized?: boolean;
  defaultValue?: any;
  serializedChoices?: any[];
  moduleName?: string;
  eventSenderName?: string;
  eventOptionsName?: string;
}
const callbackFuncResultStr = ") => ";
var isExportingReact: boolean = false;
var jsonObjMetaData: any = null;
const tsDefaultOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.ES2015,
//  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  lib: ["DOM", "ES5", "ES6", "ES2015.Promise"],
  noImplicitAny: true,
  importHelpers: false,
  experimentalDecorators: true,
  allowSyntheticDefaultImports: true,
  jsx: ts.JsxEmit.React,
  baseUrl: "."
};
    //"lib": [ "es2015", "es2017", "es6", "dom", "es2015.iterable" ],
function getTsOptions(options: ts.CompilerOptions): ts.CompilerOptions {
  const res: ts.CompilerOptions = {};
  for(key in tsDefaultOptions) res[key] = tsDefaultOptions[key];
  for(var key in options) res[key] = options[key];
  return res;
}

export function setJsonObj(obj: any) {
  jsonObjMetaData = obj;
}

function printError(text: string) {
  console.log(text);
}

function checkFiles(fileNames: string[], errorText: string) {
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
function getAbsoluteFileName(name: string): string {
  return path.join(process.cwd(), name);
}

export interface IDtsBundleOptions {
  entries: string[],
  out: string,
  name: string,
  license: string,
  excludeImports? : boolean,
  paths?: ts.MapLike<string[]>
}

export function generateDts(options: IDtsBundleOptions) {
  if(!options.out) {
    printError("out is empty.");
    return;
  }
  let outDir = path.dirname(options.out);
  if(!checkFiles([outDir], "directory for out file is not found")) return;
  const docOptions = {
    generateDoc: false,
    generateJSONDefinition: false,
    dtsOutput: options.out,
    dtsExcludeImports: options.excludeImports === true,
    paths: options.paths,
    name: options.name,
    license: options.license,
  };
  const tsOptions: ts.CompilerOptions = {};
  if(options.paths) {
    tsOptions.paths = options.paths;
    tsOptions.baseUrl = process.cwd();
  }
  generateDocumentation(options.entries, tsOptions, docOptions);
  if(!checkFiles([options.out], "Generated d.ts file is not found")) return;

  const program = ts.createProgram([options.out], getTsOptions(tsOptions));
  const srcFile = program.getSourceFile(options.out);
  const diagnostics = program.getSyntacticDiagnostics(srcFile);
  for(var i = 0; i < diagnostics.length; i ++) {
    const msgText: any = diagnostics[i].messageText;
    let errorText = "Error: "  + (!!msgText.messageText? msgText.messageText: msgText);
    if(!!diagnostics[i].source) {
      errorText += " . Source: " + diagnostics[i].source;
    }
    printError(errorText);
  }
}
/** Generate documentation for all classes in a set of .ts files */
export function generateDocumentation(
  fileNames: string[], options: ts.CompilerOptions, docOptions: any = {}
): void {
  let dtsVueGeneratedFiles = [];
  generateVueTSFiles(fileNames);
  const tsOptions: ts.CompilerOptions = getTsOptions(options);
  if(!checkFiles(fileNames, "File for compiling is not found")) return;
  const host = ts.createCompilerHost(tsOptions);
  // Build a program using the set of root file names in fileNames
  const program = ts.createProgram(fileNames, tsOptions, host);

  // Get the checker, we will use it to find more about classes
  let checker = program.getTypeChecker();
  let outputClasses: DocEntry[] = [];
  let outputPMEs: DocEntry[] = [];
  let pmesHash = {};
  let classesHash = {};
  let curClass: DocEntry = null;
  let curJsonName: string = null;
  let generateJSONDefinitionClasses = {};
  let dtsOutput = !!docOptions ? docOptions.dtsOutput : undefined;
  let generateDts = !!dtsOutput;
  let generateJSONDefinition = docOptions.generateJSONDefinition === true;
  let generateDocs = !generateDts || docOptions.generateDoc !== false;
  let outputDefinition = {};
  let dtsExportedClasses = {}
  let dtsExportClassesFromLibraries = [];
  let dtsImports = {};
  let dtsExcludeImports = docOptions.dtsExcludeImports === true;
  const dtsExportNames = [];
  if(!!docOptions.paths) {
    for(key in docOptions.paths) dtsExportNames.push(key);
  }
  let dtsImportDeclarations = {};
  let dtsFrameworksImportDeclarations = {};
  let dtsDeclarations = {};
  let dtsTypesParameters = {};
  let dtsTypesArgumentParameters = {};
  let dtsProductName = docOptions.name;
  let dtsLicense = docOptions.license;
  let dtsVersion = "";
  // Visit every sourceFile in the program
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName.indexOf("node_modules") > 0) continue;
    if(isNonEnglishLocalizationFile(sourceFile.fileName)) continue;
    // Walk the tree to search for classes
    ts.forEachChild(sourceFile, visit);
  }
  for(var i = 0; i < fileNames.length; i ++) {
    const sourceFile = program.getSourceFile(fileNames[i]);
    if(!!sourceFile) {
      ts.forEachChild(sourceFile, visit);
    }
  }
  for (var key in classesHash) {
    setAllParentTypes(key);
  }
  if(generateDocs) {
    updateEventsDocumentation();
    // print out the doc
    fs.writeFileSync(
      process.cwd() + "/docs/classes.json",
      JSON.stringify(outputClasses, undefined, 4)
    );
    fs.writeFileSync(
      process.cwd() + "/docs/pmes.json",
      JSON.stringify(outputPMEs, undefined, 4)
    );
  }
  if (generateJSONDefinition) {
    outputDefinition["$schema"] = "http://json-schema.org/draft-07/schema#";
    outputDefinition["title"] = "SurveyJS Library json schema";
    addClassIntoJSONDefinition("SurveyModel", true);
    fs.writeFileSync(
      process.cwd() + "/docs/surveyjs_definition.json",
      JSON.stringify(outputDefinition, undefined, 4)
    );
  }
  if(generateDts) {
    prepareDtsInfo();
    dtsImportFiles(docOptions.paths);
    let text = "";
    if(!!dtsProductName) {
      dtsVersion = dtsGetVersion();
      text += dtsGetBanner();
    }
    text += dtsGetText();
    fs.writeFileSync(getAbsoluteFileName(dtsOutput), text);
  }
  deleteVueTSFiles();
  return;
  function generateVueTSFiles(fileNames: string[]) {
    for(var i = 0; i < fileNames.length; i++) {
      const fn = fileNames[i];
      let text: string = fs.readFileSync(getAbsoluteFileName(fn), 'utf8');
      const dir = path.dirname(fn);
      generateVueTSFile(text, dir);
      const matchArray = text.match(/(?<=export \* from ")(.*)(?=";)/gm);
      if(!Array.isArray(matchArray)) continue;
      for (var i = 0; i < matchArray.length; i++) {
          const fnChild = path.join(dir, matchArray[i] + ".ts");
          const absFnChild = getAbsoluteFileName(fnChild);
          if(!fs.existsSync(absFnChild)) return;
          text = fs.readFileSync(absFnChild, 'utf8');
          generateVueTSFile(text, dir);
      }    
    }
  }
  function generateVueTSFile(text: string, dir: string) {
    const matchArray = text.match(/(?<=")(.*)(?=.vue";)/gm);
    if(!Array.isArray(matchArray)) return;
    for(var i = 0; i < matchArray.length; i ++) {
      const fileName = path.join(dir, matchArray[i] + ".vue");
      if(!fs.existsSync(fileName)) continue;
      let absFileName = getAbsoluteFileName(fileName);
      const vueText: string = fs.readFileSync(absFileName, 'utf8');
      const startStr = "<script lang=\"ts\">";
      const endStr = "</script>";
      const startIndex = vueText.indexOf(startStr) + startStr.length;
      const endIndex = vueText.lastIndexOf(endStr);
      if(endIndex > startIndex && startIndex > 0) {
        const vue_tsText = vueText.substring(startIndex, endIndex);
        absFileName += ".ts";
        dtsVueGeneratedFiles.push(absFileName);
        fs.writeFileSync(absFileName, vue_tsText);
      }
    }
  }
  function deleteVueTSFiles() {
    for(var i = 0; i < dtsVueGeneratedFiles.length; i ++) {
      fs.unlinkSync(dtsVueGeneratedFiles[i]);
    }
  }
  function isNonEnglishLocalizationFile(fileName: string): boolean {
    const dir = path.dirname(fileName);
    const name = path.basename(fileName);
    if(name === "english") return false;
    const loc = "localization";
    return dir.lastIndexOf(loc) > dir.length - loc.length - 3;
  }
  function dtsGetVersion(): string {
    const fileName = getAbsoluteFileName("package.json");
    if(!fs.existsSync(fileName)) return "";
    const text = fs.readFileSync(fileName, 'utf8');
    if(!text) return "";
    const matches = text.match(/(?<="version":)(.*)(?=,)/gm);
    if(!Array.isArray(matches) || matches.length === 0) return "";
    let res = matches[0];
    if(!res) return "";
    return res.trim().replace("\"", "").replace("\"", "");
  }
  function dtsGetBanner(): string {
    const lines = [];
    lines.push("/*");
    const paddging = "* ";
    lines.push(paddging + dtsProductName + (dtsVersion ? " v" + dtsVersion : ""));
    lines.push(paddging + "Copyright (c) 2015-" + new Date().getFullYear() + " Devsoft Baltic OÜ  - https://surveyjs.io/");
    if(dtsLicense) {
      lines.push(paddging + "License: " + dtsLicense);
    }
    lines.push("*/");
    lines.push("");
    return lines.join("\n");
  }
/** set allParentTypes */
  function setAllParentTypes(className: string) {
    if (!className) return;
    var cur = classesHash[className];
    if (cur.allTypes && cur.allTypes.length > 0) return;
    setAllParentTypesCore(cur);
  }
  function setAllParentTypesCore(cur: any) {
    cur.allTypes = [];
    cur.allTypes.push(cur.name);
    if(cur.entryType === DocEntryType.interfaceType && Array.isArray(cur.implements)) {
      cur.implements.forEach(item => addBaseAllTypesIntoCur(cur, item));
    }
    if (!cur.baseType) return;
    addBaseAllTypesIntoCur(cur, cur.baseType);
  }
  function addBaseAllTypesIntoCur(cur: any, className: string): void {
    if(!className) return;
    var baseClass = classesHash[className];
    if (!baseClass) return;
    if (!baseClass.allTypes) {
      setAllParentTypesCore(baseClass);
    }
    for (var i = 0; i < baseClass.allTypes.length; i++) {
      cur.allTypes.push(baseClass.allTypes[i]);
    }
  }
  /** visit nodes finding exported classes */
  function visit(node: ts.Node) {
    // Only consider exported nodes
    if (!isNodeExported(node)) return;
    if (node.kind === ts.SyntaxKind.EnumDeclaration) {
      const enNode = <ts.EnumDeclaration>node;
      let symbol = checker.getSymbolAtLocation(enNode.name);
      if (!!symbol && generateDts) {
        visitEnumNode(enNode, symbol);
      }
    } else if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
      const fnNode = <ts.FunctionDeclaration>node;
      let symbol = checker.getSymbolAtLocation(fnNode.name);
      if (!!symbol && generateDts) {
        visitFunctionNode(fnNode, symbol);
      }
    } else if (node.kind === ts.SyntaxKind.VariableStatement) {
      const vsNode = <ts.VariableStatement>node;
      if(vsNode.declarationList.declarations.length > 0) {
        const varNode = vsNode.declarationList.declarations[0];
        let symbol = checker.getSymbolAtLocation(
          (<ts.VariableDeclaration>varNode).name
        );
        if (!!symbol && (generateDts || isSymbolHasComments(symbol))) {
          visitVariableNode(varNode, symbol);
        }
      }
    } else if (node.kind === ts.SyntaxKind.ClassDeclaration) {
      // This is a top level class, get its symbol
      let symbol = checker.getSymbolAtLocation(
        (<ts.ClassDeclaration>node).name
      );
      if(!symbol) return;
      if (generateDts || isSymbolHasComments(symbol)) {
        visitDocumentedNode(node, symbol);
      }
    } else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      // This is a top level class, get its symbol
      const name = (<ts.InterfaceDeclaration>node).name;
      let symbol = checker.getSymbolAtLocation(name);
      if (generateDts || isSymbolHasComments(symbol) || isOptionsInterface(name.text)) {
        visitDocumentedNode(node, symbol);
      }
    } else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
      // This is a namespace, visit its children
      ts.forEachChild(node, visit);
    } else if(node.kind === ts.SyntaxKind.ExportDeclaration) {
      visitExportDeclarationNode(<ts.ExportDeclaration>node);
    }
  }
  function visitExportDeclarationNode(node: ts.ExportDeclaration) {
    if(!node.exportClause) return;
    if(isExportFromDtsFile(node)) return;
    const els = (<any>node.exportClause).elements;
    if(!Array.isArray(els)) return;
    const exportLibrary = getExportLibraryName(node);
    for(var i = 0; i < els.length; i ++) {
      const el = els[i];
      if(!el.name || !el.propertyName && !exportLibrary) continue;
      const name = el.name.text;
      if(!name) continue;
      if(!exportLibrary && dtsImportDeclarations[name]) continue;
      const entry: DocEntry = { name: name };
      if(!!el.propertyName) {
        entry.className = el.propertyName.text
      } 
      if(!!exportLibrary) {
        entry.fileName = exportLibrary;
      }
      dtsExportClassesFromLibraries.push(entry);
    }
  }
  function isExportFromDtsFile(node: ts.ExportDeclaration): boolean {
    if(!node.parent) return false;
    const file = node.parent.getSourceFile();
    if(!file) return false;
    return file.fileName.indexOf(".d.ts") > -1;
  }
  function getExportLibraryName(node: ts.ExportDeclaration): string {
    const name = !!node.moduleSpecifier ? (<any>node.moduleSpecifier).text : undefined;
    if(!name) return undefined;
    return dtsExportNames.indexOf(name) > -1 ? name : undefined;
  }
  function visitVariableNode(node: ts.VariableDeclaration, symbol: ts.Symbol) {
    const entry = serializeSymbol(symbol);
    entry.entryType = DocEntryType.variableType;
    dtsDeclarations[entry.name] = entry;
    visitVariableProperties(entry, node);
    if(generateDocs) {
      entry.allTypes = [entry.name];
      entry.isPublic = true;
      outputClasses.push(entry);
      entry.members = [];
    }
  }
  function visitEnumNode(node: ts.EnumDeclaration, symbol: ts.Symbol) {
    let modifier = ts.getCombinedModifierFlags(node);
    if ((modifier & ts.ModifierFlags.Export) === 0) return;
    const entry = {
      name: symbol.name,
      entryType: DocEntryType.enumType,
      members: []
    };
    dtsDeclarations[entry.name] = entry;
    for(var i = 0; i < node.members.length; i ++) {
      const member = node.members[i];
      const sym = checker.getSymbolAtLocation(member.name);
      if(!!sym && !!sym.name) {
        const id = !!member.initializer ? (<any>member.initializer).text : undefined;
        entry.members.push({ name: sym.name, returnType: id});
      }
    }
  }
  function visitFunctionNode(node: ts.FunctionDeclaration, symbol: ts.Symbol) {
    let modifier = ts.getCombinedModifierFlags(node);
    if ((modifier & ts.ModifierFlags.Export) === 0) return;
    const entry = serializeMethod(symbol, node);
    if(!entry) return;
    entry.entryType = DocEntryType.functionType;
    dtsDeclarations[entry.name] = entry;
  }
  function visitVariableProperties(entry: DocEntry, node: ts.VariableDeclaration) {
    if(!node.initializer) return;
    const children = (<any>node.initializer).properties;
    if(!Array.isArray(children)) return;
    for(var i = 0; i < children.length; i ++) {
      visitVariableMember(entry, children[i]);
    }
  }
  function visitVariableMember(entry: DocEntry, node: ts.Node) {
    let symbol = checker.getSymbolAtLocation(
      (<ts.ClassDeclaration>node).name
    );
    const memberEntry = serializeClass(symbol, node);
    if(memberEntry) {
      if(!entry.members) entry.members = [];
      entry.members.push(memberEntry);
      entry.members.push(memberEntry);
      if(generateDocs) {
          if(entry.entryType === DocEntryType.variableType) {
              outputPMEs.push(memberEntry);
              memberEntry.className = entry.name;
              memberEntry.pmeType = "property";
              memberEntry.isPublic = true;
              memberEntry.isField = true,
              memberEntry.hasSet = true;
          }
      }
      visitVariableProperties(memberEntry, <ts.VariableDeclaration>node);
    }
  }
  function visitDocumentedNode(node: ts.Node, symbol: ts.Symbol) {
    curClass = serializeClass(symbol, node);
    classesHash[curClass.name] = curClass;
    let isOptions = curClass.name.indexOf("IOn") === 0;
    if(!isOptions) {
      outputClasses.push(curClass);
    }
    curJsonName = null;
    ts.forEachChild(node, visitClassNode);
    if(isOptions) return;
    if (!curJsonName) return;
    curClass.jsonName = curJsonName;
    if (!jsonObjMetaData || !generateDocs) return;
    var properties = jsonObjMetaData.getProperties(curJsonName);
    for (var i = 0; i < outputPMEs.length; i++) {
      if (outputPMEs[i].className == curClass.name) {
        var propName = outputPMEs[i].name;
        for (var j = 0; j < properties.length; j++) {
          if (properties[j].name == propName) {
            outputPMEs[i].isSerialized = true;
            if (properties[j].defaultValue)
              outputPMEs[i].defaultValue = properties[j].defaultValue;
            if (properties[j].choices)
              outputPMEs[i].serializedChoices = properties[j].choices;
            if (properties[j].className)
              outputPMEs[i].jsonClassName = properties[j].className;
            break;
          }
        }
      }
    }
  }
  function visitClassNode(node: ts.Node) {
    var symbol = null;
    if (node.kind === ts.SyntaxKind.MethodDeclaration)
      symbol = checker.getSymbolAtLocation((<ts.MethodDeclaration>node).name);
    if (node.kind === ts.SyntaxKind.FunctionDeclaration)
      symbol = checker.getSymbolAtLocation((<ts.FunctionDeclaration>node).name);
    if (node.kind === ts.SyntaxKind.PropertyDeclaration)
      symbol = checker.getSymbolAtLocation((<ts.PropertyDeclaration>node).name);
    if (node.kind === ts.SyntaxKind.GetAccessor)
      symbol = checker.getSymbolAtLocation(
        (<ts.GetAccessorDeclaration>node).name
      );
    if (node.kind === ts.SyntaxKind.SetAccessor)
      symbol = checker.getSymbolAtLocation(
        (<ts.SetAccessorDeclaration>node).name
      );
    if (node.kind === ts.SyntaxKind.PropertySignature)
      symbol = checker.getSymbolAtLocation((<ts.PropertySignature>node).name);
    if (node.kind === ts.SyntaxKind.MethodSignature)
      symbol = checker.getSymbolAtLocation((<ts.MethodSignature>node).name);
    if(!symbol) return;
    if (!isPMENodeExported(node, symbol)) return;
    var ser = serializeMember(symbol, node);
    let fullName = ser.name;
    if (curClass) {
      ser.className = curClass.name;
      ser.jsonName = curClass.jsonName;
      fullName = curClass.name + "." + fullName;
      if(!curClass.members) curClass.members = [];
      curClass.members.push(ser);
    }
    ser.pmeType = getPMEType(node.kind);
    const modifier = ts.getCombinedModifierFlags(<ts.Declaration>node);
    if ((modifier & ts.ModifierFlags.Static) !== 0) {
      ser.isStatic = true;
    }
    if ((modifier & ts.ModifierFlags.Protected) !== 0) {
      ser.isProtected = true;
    }
    if(node.kind === ts.SyntaxKind.PropertyDeclaration 
      && !ser.isLocalizable
      && ser.isField === undefined) {
      ser.isField = true;
    }
    if(node.kind === ts.SyntaxKind.PropertySignature) {
      ser.isField = true;
      ser.isOptional = checker.isOptionalParameter(<any>node);
    }
    if (isSurveyEventType(ser.type)) {
      ser.pmeType = "event";
      updateEventOptionInterfaceName(node, ser);
      if (!ser.documentation && (ser.eventSenderName === "__type" || !ser.eventOptionsName)) {
        ser = null;
      }
    }
    if (node.kind === ts.SyntaxKind.GetAccessor) {
      ser.isField = false;
      let serSet = pmesHash[fullName];
      if (serSet) {
        ser.hasSet = serSet.hasSet;
      } else ser.hasSet = false;
    }
    if (node.kind === ts.SyntaxKind.SetAccessor) {
      let serGet = pmesHash[fullName];
      if (serGet) {
          serGet.hasSet = true;
          ser.isField = false;
      }
      ser = null;
    }
    if (ser) {
      if (!ser.parameters) ser.parameters = [];
      pmesHash[fullName] = ser;
      outputPMEs.push(ser);
    }
    if (ser && ser.name === "getType") {
      curJsonName = getJsonTypeName(<ts.FunctionDeclaration>node);
    }
  }
  function getJsonTypeName(node: ts.FunctionDeclaration): string {
    let body = (<ts.FunctionDeclaration>node).getFullText();
    if (body) {
      var pos = body.indexOf('return "');
      if (pos > 0) {
        body = body.substr(pos + 'return "'.length);
        pos = body.indexOf('"');
        return body.substr(0, pos);
      }
    }
    return null;
  }
  function isSurveyEventType(type: string): boolean {
    return !!type && (type.indexOf("Event") === 0 || type.indexOf("CreatorEvent") === 0);
  }
  function getPMEType(nodeKind: ts.SyntaxKind) {
    if (nodeKind === ts.SyntaxKind.MethodDeclaration || nodeKind === ts.SyntaxKind.MethodSignature) return "method";
    if (nodeKind === ts.SyntaxKind.FunctionDeclaration) return "function";
    return "property";
  }
  function getTypeOfSymbol(symbol: ts.Symbol): ts.Type {
    if (symbol.valueDeclaration)
      return checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    return checker.getDeclaredTypeOfSymbol(symbol);
  }
  function updateEventOptionInterfaceName(node: ts.Node, ser: DocEntry): void {
    const typeObj: any = checker.getTypeAtLocation(node);
    if(!typeObj) return;
    const args = typeObj.typeArguments;
    if(!Array.isArray(args) || args.length < 2) return;
    ser.eventSenderName = getSymbolName(args[0].symbol);
    ser.eventOptionsName = getSymbolName(args[1].symbol);
  }
  function getSymbolName(symbol: any): string {
    return !!symbol && !!symbol.name ? symbol.name : ""; 
  }
  /** Serialize a symbol into a json object */

  function serializeSymbol(symbol: ts.Symbol): DocEntry {
    const type = getTypeOfSymbol(symbol);
    const docParts = symbol.getDocumentationComment(undefined);
    const modifiedFlag = !!symbol.valueDeclaration ? ts.getCombinedModifierFlags(symbol.valueDeclaration) : 0;
    const isPublic = (modifiedFlag & ts.ModifierFlags.Public) !== 0;
    const res = {
      name: symbol.getName(),
      documentation: !!docParts ? ts.displayPartsToString(docParts) : "",
      type: checker.typeToString(type),
      isPublic: isPublic
    };
    var jsTags = symbol.getJsDocTags();
    if (jsTags) {
      var seeArray = [];
      for (var i = 0; i < jsTags.length; i++) {
        if (jsTags[i].name == "title") {
          res["metaTitle"] = jsTags[i].text;
        }
        if (jsTags[i].name == "description") {
          res["metaDescription"] = jsTags[i].text;
        }
        if (jsTags[i].name == "see") {
          seeArray.push(jsTags[i].text);
        }
      }
      if (seeArray.length > 0) {
        res["see"] = seeArray;
      }
    }
    return res;
  }

  /** Serialize a class symbol information */
  function serializeClass(symbol: ts.Symbol, node: ts.Node) {
    let details = serializeSymbol(symbol);
    details.implements = getImplementedTypes(node, details.name);
    setTypeParameters(details.name, node);
    if(node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      details.entryType = DocEntryType.interfaceType;
    }
    if (node.kind !== ts.SyntaxKind.ClassDeclaration) return details;
    // Get the construct signatures
    let constructorType = checker.getTypeOfSymbolAtLocation(
      symbol,
      symbol.valueDeclaration
    );
    details.entryType = DocEntryType.classType;
    details.constructors = getConstructors(constructorType);
    createPropertiesFromConstructors(details);
    const firstHeritageClauseType = getFirstHeritageClauseType(<ts.ClassDeclaration>node);
    details.baseType = getBaseType(firstHeritageClauseType);
    setTypeParameters(details.baseType, firstHeritageClauseType, details.name);
    return details;
  }
  function getConstructors(constructorType: ts.Type): DocEntry[] {
    const res = [];
    const signitures = constructorType.getConstructSignatures();
    for(var i = 0; i < signitures.length; i ++) {
      if(!signitures[i].declaration) continue;
      res.push(serializeSignature(signitures[i]));
    }
    return res;
  }
  function createPropertiesFromConstructors(entry: DocEntry) {
    if(!Array.isArray(entry.constructors)) return;
    for(var i = 0; i < entry.constructors.length; i ++) {
      createPropertiesFromConstructor(entry, entry.constructors[i]);
    }
  }
  function createPropertiesFromConstructor(classEntry: DocEntry, entry: DocEntry) {
    if(!Array.isArray(entry.parameters)) return;
    for(var i = 0; i < entry.parameters.length; i ++) {
      const param = entry.parameters[i];
      if(!param.isPublic) continue;
      if(!classEntry.members) classEntry.members = [];
      classEntry.members.push(
        { name: param.name, pmeType: "property", isField: true, isPublic: true, type: param.type}
    );
    }
  }
  function getHeritageClause(node: ts.ClassDeclaration, index: number): ts.HeritageClause {
    if (!node || !node.heritageClauses || node.heritageClauses.length <= index) return undefined;
    return node.heritageClauses[index];
  }
  function getFirstHeritageClauseType(node: ts.ClassDeclaration): ts.ExpressionWithTypeArguments {
    const clause = getHeritageClause(node, 0);
    return !!clause ? clause.types[0] : undefined;
  }
  function getImplementedTypes(node: ts.Node, className: string): string[] {
    if(!node || !(<ts.ClassDeclaration>node).heritageClauses) return undefined;
    const clauses = (<ts.ClassDeclaration>node).heritageClauses;
    if(!Array.isArray(clauses) || clauses.length == 0) return undefined;
    const res = [];
    for(var i = 0; i < clauses.length; i ++) {
      getImplementedTypesForClause(res, clauses[i], className);
    }
    return res;
  }
  function getImplementedTypesForClause(res: string[], clause: ts.HeritageClause, className: string) {
    if(!clause || !Array.isArray(clause.types)) return undefined;
    for(var i = 0;  i < clause.types.length; i ++) {
      const name = getBaseType(clause.types[i]);
      if(!!name) {
        res.push(name);
        setTypeParameters(name, clause.types[i], className);
      }
    }
  }
  function getBaseType(firstHeritageClauseType: ts.ExpressionWithTypeArguments): string {
    if(!firstHeritageClauseType) return "";
    const extendsType = checker.getTypeAtLocation(
      firstHeritageClauseType.expression
    );
    const expression: any = firstHeritageClauseType.expression;
    if (extendsType && extendsType.symbol) {
      const name = extendsType.symbol.name;
      if(!!expression.expression && expression.expression.escapedText)
        return expression.expression.escapedText + "." + name;
      return name;
    }
    if(!!expression.text) return expression.text;
    if(!!expression.expression && !!expression.expression.text && !!expression.name && !!expression.name.text)
      return expression.expression.text + "." + expression.name.text;
    return "";
  }
  function setTypeParameters(typeName: string, node: ts.Node, forTypeName?: string) {
    if(!typeName || !node) return;
    const parameters = getTypedParameters(node, !!forTypeName);
    if(!parameters) return;
    if(!forTypeName) {
      dtsTypesParameters[typeName] = parameters;
    } else {
      let args = dtsTypesArgumentParameters[typeName];
      if(!args) {
        args = {};
        dtsTypesArgumentParameters[typeName] = args;
      }
      args[forTypeName] = parameters;
    }
  }
  function getTypedParameters(node: ts.Node, isArgument: boolean): string[] {
    const params = getTypeParametersDeclaration(node, isArgument);
    if(!params || !Array.isArray(params)) return undefined;
    const res = [];
    for(var i = 0; i < params.length; i ++) {
      const name = getTypeParameterName(params[i], isArgument);
      const extendsType = getTypeParameterConstrains(params[i]); 
      res.push(name + extendsType);
    }
    return res.length > 0 ? res : undefined;
  }
  function getTypeParameterName(node: any, isArgument: boolean): string {
    let symbol = checker.getSymbolAtLocation(isArgument? (<any>node).typeName : node.name);
    if (!!symbol && symbol.name) return symbol.name;
    return "any";
  }
  function getTypeParameterConstrains(node: any): string {
    if(!node.default) return "";
    const first = getTypeParameterName(node.default, true);
    const second =  !!node.constraint ? getTypeParameterName(node.constraint, true) : "";
    if(!first) return "";
    if(!!second) return " extends " + first + " = " + second;
    return " = " + first;
  }
  function getTypeParametersDeclaration(node: any, isArgument: boolean): Array<ts.TypeParameterDeclaration> {
    if(!node) return undefined;
    if(!isArgument && !!node.typeParameters) return node.typeParameters;
    if(isArgument && !!node.typeArguments) return node.typeArguments;
    if(isArgument && !!node.elementType) return [<ts.TypeParameterDeclaration>node.elementType];
    return undefined;
  }
  function serializeMember(symbol: ts.Symbol, node: ts.Node) {
    const details = serializeSymbol(symbol);
    if (getPMEType(node.kind) !== "property") {
      setupMethodInfo(details, symbol, node);
    } else {
      details.isLocalizable = getIsPropertyLocalizable(node);
      if(details.isLocalizable) {
        details.hasSet = true; 
      }
    }
    return details;
  }
  /** Serialize a method symbol infomration */
  function serializeMethod(symbol: ts.Symbol, node: ts.Node) {
    const details = serializeSymbol(symbol);
    setupMethodInfo(details, symbol, node);
    return details;
  }
  function setupMethodInfo(entry: DocEntry, symbol: ts.Symbol, node: ts.Node) {
    let signature = checker.getSignatureFromDeclaration(
      <ts.SignatureDeclaration>node
    );
    const funDetails = serializeSignature(signature);
    entry.parameters = funDetails.parameters;
    entry.returnType = funDetails.returnType;
    entry.typeGenerics = getTypedParameters(node, false);
    entry.returnTypeGenerics = getTypedParameters((<ts.SignatureDeclaration>node).type, true);
    if(entry.returnType === "Array" && !entry.returnTypeGenerics) {
      entry.returnTypeGenerics = ["any"];
    }
  }
  function getIsPropertyLocalizable(node: ts.Node): boolean {
    if(!Array.isArray(node.decorators)) return false;
    for(var i = 0; i < node.decorators.length; i ++) {
      const decor = node.decorators[i];
      const expression = decor.expression["expression"];
      const decor_arguments: ts.Node[] = decor.expression["arguments"];
      if(!expression || !Array.isArray(decor_arguments)) continue;
      const sym = checker.getSymbolAtLocation(expression);
      if(!sym || sym.name !== "property") continue;
      for(var j = 0; j < decor_arguments.length; j ++) {
        const arg = decor_arguments[j];
        const props: ts.Node[] = arg["properties"];
        if(!Array.isArray(props)) continue;
        for(var k = 0; k < props.length; k ++) {
          const name: ts.Node = props[k]["name"];
          if(!name) continue;
          const symName = checker.getSymbolAtLocation(name);
          if(!!symName && symName.name === "localizable") return true;
        }
      }
    }
    return false;
  }
  /** Serialize a signature (call or construct) */
  function serializeSignature(signature: ts.Signature) {
    const params = signature.parameters;
    const res = {
      parameters: params.map(serializeSymbol),
      returnType: getReturnType(signature),
      documentation: ts.displayPartsToString(
        signature.getDocumentationComment(undefined)
      ),
    };
    for(var i = 0; i < params.length; i ++) {
      const node: any = params[i].valueDeclaration;
      if(!!node) {
        res.parameters[i].isOptional = checker.isOptionalParameter(node);
      }
    }
    return res;
  }
  function getReturnType(signature: ts.Signature): string {
    var res = checker.typeToString(signature.getReturnType());
    if(res === "{}") res = "any";
    if(res !== "any") return res;
    const type = signature.declaration.type;
    if(!type) return res;
    if(type.kind === ts.SyntaxKind.ArrayType) return "Array";
    if(!type["typeName"]) return res;
    const name = type["typeName"].text;
    return !!name ? name : res;
  }
  /** True if this is visible outside this file, false otherwise */
  function isNodeExported(node: ts.Node): boolean {
    return (
      (node.flags & ts.NodeFlags["Export"]) !== 0 ||
      (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }
  function isPMENodeExported(node: ts.Node, symbol: ts.Symbol): boolean {
    let modifier = ts.getCombinedModifierFlags(<ts.Declaration>node);
    if ((modifier & ts.ModifierFlags.Public) !== 0) return true;
    if(generateDts && modifier === 0) return true;
    if(generateDts && (modifier & ts.ModifierFlags.Protected) !== 0) return true;
    if(node.kind === ts.SyntaxKind.PropertyDeclaration) return true;
    if(isSymbolHasComments(symbol)) return true;
    /*
    let docTags = symbol.getJsDocTags();
    if(Array.isArray(docTags) && docTags.length > 0) return true;
    if(!!symbol.valueDeclaration) {
      docTags = symbol.valueDeclaration["jsDoc"];
      if(Array.isArray(docTags) && docTags.length > 0) return true;
    }
    */
    var parent = node.parent;
    return parent && parent.kind === ts.SyntaxKind.InterfaceDeclaration;
  }
  /** True if there is a comment before declaration */
  function isSymbolHasComments(symbol: ts.Symbol): boolean {
    let com = symbol.getDocumentationComment(undefined);
    return com && com.length > 0;
  }
  function isOptionsInterface(name: string): boolean {
    return name.indexOf("Options") > -1 || name.indexOf("Event") > -1;
  }
  function addClassIntoJSONDefinition(
    className: string,
    isRoot: boolean = false
  ) {
    if (className == "IElement") {
      className = "SurveyElement";
    }
    if (!!generateJSONDefinitionClasses[className]) return;
    generateJSONDefinitionClasses[className] = true;
    var cur = classesHash[className];
    if (!isRoot && (!cur || !hasSerializedProperties(className))) {
      addChildrenClasses(className);
      return;
    }
    if (!cur || (!isRoot && hasClassInJSONDefinition(className))) return;
    var root = outputDefinition;
    if (!isRoot) {
      if (!outputDefinition["definitions"]) {
        outputDefinition["definitions"] = {};
      }
      outputDefinition["definitions"][cur.jsonName] = {};
      root = outputDefinition["definitions"][cur.jsonName];
      root["$id"] = "#" + cur.jsonName;
    }
    root["type"] = "object";
    addPropertiesIntoJSONDefinion(cur, root);
    if (!isRoot) {
      addParentClass(cur, root);
      addChildrenClasses(cur.name);
    }
  }
  function addParentClass(cur: DocEntry, root: any) {
    if (!cur.baseType) return;
    addClassIntoJSONDefinition(cur.baseType);
    var parentClass = classesHash[cur.baseType];
    if (!!parentClass && hasClassInJSONDefinition(parentClass.jsonName)) {
      var properties = root["properties"];
      delete root["properties"];
      root["allOff"] = [
        { $ref: "#" + parentClass.jsonName },
        { properties: properties },
      ];
    }
  }
  function addChildrenClasses(className: string) {
    for (var i = 0; i < outputClasses.length; i++) {
      if (outputClasses[i].baseType == className) {
        addClassIntoJSONDefinition(outputClasses[i].name);
      }
    }
  }

  function hasClassInJSONDefinition(className: string) {
    return (
      !!outputDefinition["definitions"] &&
      !!outputDefinition["definitions"][className]
    );
  }
  function addPropertiesIntoJSONDefinion(cur: any, jsonDef: any) {
    for (var i = 0; i < outputPMEs.length; i++) {
      var property = outputPMEs[i];
      if (property.className !== cur.name || !property.isSerialized)
        continue;
      addPropertyIntoJSONDefinion(property, jsonDef);
    }
  }
  function hasSerializedProperties(className: string): boolean {
    for (var i = 0; i < outputPMEs.length; i++) {
      var property = outputPMEs[i];
      if (property.className == className && property.isSerialized) return true;
    }
    return false;
  }
  function addPropertyIntoJSONDefinion(property, jsonDef) {
    if (!jsonDef.properties) {
      jsonDef.properties = {};
    }
    var properties = jsonDef.properties;
    var typeName = property.type;
    var isArray = !!typeName && typeName.indexOf("[]") > -1;
    if (!!property.jsonClassName || isArray) {
      addClassIntoJSONDefinition(typeName.replace("[]", ""));
    }
    var typeInfo: any = getTypeValue(property);
    var propInfo: any = { type: typeInfo };
    if (isArray) {
      propInfo = { type: "array", items: typeInfo };
    }
    if (
      !!property.serializedChoices &&
      Array.isArray(property.serializedChoices) &&
      property.serializedChoices.length > 1
    ) {
      propInfo["enum"] = property.serializedChoices;
    }
    properties[property.name] = propInfo;
  }
  function getTypeValue(property: DocEntry): any {
    var propType = property.type;
    if (propType.indexOf("|") > 0) return ["boolean", "string"];
    if (propType == "any") return ["string", "numeric", "boolean"];
    if (propType == "string" || propType == "numeric" || propType == "boolean")
      return propType;
    var childrenTypes = [];
    addChildrenTypes(propType.replace("[]", ""), childrenTypes);
    if (childrenTypes.length == 1) return getReferenceType(childrenTypes[0]);
    if (childrenTypes.length > 1) {
      var res = [];
      for (var i = 0; i < childrenTypes.length; i++) {
        res.push(getReferenceType(childrenTypes[i]));
      }
      return res;
    }
    return getReferenceType(propType.replace("[]", ""));
  }
  function addChildrenTypes(type: string, childrenTypes: Array<string>) {
    if (type == "IElement") type = "SurveyElement";
    for (var i = 0; i < outputClasses.length; i++) {
      if (outputClasses[i].baseType == type) {
        var count = childrenTypes.length;
        addChildrenTypes(outputClasses[i].name, childrenTypes);
        if (count == childrenTypes.length) {
          childrenTypes.push(outputClasses[i].name);
        }
      }
    }
  }
  function updateEventsDocumentation() {
    for(let i = 0; i < outputPMEs.length; i ++) {
      const ser = outputPMEs[i];
      if(!ser.eventSenderName) continue;
      if(!ser.documentation) ser.documentation = "";
      if(ser.documentation.indexOf("- `sender`:") > -1) continue;
      const lines = [];
      lines.push("");
      lines.push("Parameters:");
      lines.push("");
      updateEventDocumentationSender(ser, lines);
      updateEventDocumentationOptions(ser, lines);
      let replacedTextIndex = ser.documentation.indexOf(EventDescriptReplacedText);
      if(replacedTextIndex > -1) {
        ser.documentation = ser.documentation.replace(EventDescriptReplacedText, lines.join("\n"));
      } else {
        lines.unshift("");
        ser.documentation += lines.join("\n");
      }
    }
  }
  function updateEventDocumentationSender(ser: DocEntry, lines: Array<string>) {
    if(!ser.eventSenderName) return;
    lines.push(" - `sender`: `"+ ser.eventSenderName + "`");
    let desc = "";
    if(ser.eventSenderName === "SurveyModel") {
      desc = SurveyModelSenderDescription;
    }
    if(!!desc) {
      lines.push(desc);
    }
  }
  function updateEventDocumentationOptions(ser: DocEntry, lines: Array<string>) {
    if(!ser.eventOptionsName) return;
    const members: any = {};
    fillEventMembers(ser.eventOptionsName, members);
    for(let key in members) {
      const m = members[key];
      let doc = m.documentation;
      lines.push("- `options." + m.name + "`: `" + m.type + "`");
      if(!!doc) {
        lines.push(doc);
      }
    };
  }
  function fillEventMembers(interfaceName: string, members: any): void {
    const classEntry: DocEntry = classesHash[interfaceName];
    if(!classEntry) return;
    if(Array.isArray(classEntry.implements)) {
      for(let i = 0; i < classEntry.implements.length; i ++) {
        fillEventMembers(classEntry.implements[i], members);
      }
    }
    if(!Array.isArray(classEntry.members)) return;
    for(let i = 0; i < classEntry.members.length; i ++) {
      const m = classEntry.members[i];
      members[m.name] = m;
    }
  } 
  function getReferenceType(type: string): any {
    var curClass = classesHash[type];
    if (!curClass) return type;
    return { $href: "#" + curClass.jsonName };
  }
  function dtsImportFiles(imports: any) {
    if(!imports) return;
    for(var key in imports) {
      const arr = imports[key];
      if(!Array.isArray(arr)) continue;
      for(var i = 0; i < arr.length; i ++) {
        importDtsFile(key, arr[i]);
      }
    }
  }
  function importDtsFile(moduleName: string, fileName: string) {
    let text: string = fs.readFileSync(getAbsoluteFileName(fileName), 'utf8');
    const regExStrs = [{regex: /(?<=export interface)(.*)(?={)/gm, type: DocEntryType.interfaceType}, 
      {regex: /(?<=export declare var)(.*)(?=:)/gm, type: DocEntryType.variableType}, 
      {regex: /(?<=export declare function)(.*)(?=\()/gm, type: DocEntryType.functionType},
      {regex: /(?<=export declare class)(.*)(?={)/gm, type: DocEntryType.classType}, 
      {regex: /(?<=export declare class)(.*)(?=extends)/gm, type: DocEntryType.classType},
      {regex: /(?<=export declare class)(.*)(?=implements)/gm, type: DocEntryType.classType},
      {regex: /(?<=export declare class)(.*)(?=<)/gm, type: DocEntryType.classType}];
    const removedWords = [" extends ", "<"]
    for(var i = 0; i < regExStrs.length; i ++) {
      const item = regExStrs[i];
      const mathArray = text.match(item.regex);
      if(!Array.isArray(mathArray)) continue;
      mathArray.forEach((name: string) => {
        if(!!name && !!name.trim()) {
          for(var rI = 0; rI < removedWords.length; rI ++) {
            const index = name.indexOf(removedWords[rI]);
            if(index > -1) {
              name = name.substring(0, index);
            }
          }
          dtsImports[name.trim()] = {name: name.trim(), moduleName: moduleName, entryType: item.type};
        }
      });
    }
  }
  function prepareDtsInfo() {
    for(var key in classesHash) {
      proccessDtsClass(classesHash[key]);
    }
  }
  function proccessDtsClass(curClass: DocEntry) {
    dtsDeclarations[curClass.name] = curClass;
  }
  function dtsGetText(): string {
    const lines = [];
    dtsRenderDeclarations(lines);
    return lines.join("\n");
  }
  function dtsRenderDeclarations(lines: string[]) {
    const classes = [];
    const interfaces = [];
    const functions = [];
    const variables = [];
    const enums = [];

    for(var key in dtsDeclarations) {
      if(dtsExcludeImports && !!dtsImports[key]) continue;
      const cur = dtsDeclarations[key];
      if (cur.entryType === DocEntryType.classType) {
          classes.push(cur);
      }
      if (cur.entryType === DocEntryType.interfaceType) {
          interfaces.push(cur);
      }
      if (cur.entryType === DocEntryType.variableType) {
        variables.push(cur);
      } 
      if (cur.entryType === DocEntryType.functionType) {
        functions.push(cur);
      } 
      if (cur.entryType === DocEntryType.enumType) {
        enums.push(cur);
      } 
    }
    for(var i = 0; i < dtsExportClassesFromLibraries.length; i ++) {
      dtsRenderExportClassFromLibraries(lines, dtsExportClassesFromLibraries[i]);
    }
    if(dtsExportClassesFromLibraries.length > 0) {
      lines.push("");
    }
    dtsSortClasses(classes);
    for (var i = 0; i < enums.length; i++) {
      dtsRenderDeclarationEnum(lines, enums[i]);
    }
    for (var i = 0; i < interfaces.length; i++) {
      dtsRenderDeclarationInterface(lines, interfaces[i]);
    }
    for(var i = 0; i < classes.length; i ++) {
      dtsRenderDeclarationClass(lines, classes[i]);
    }
    for(var i = 0; i < functions.length; i ++) {
      dtsRenderDeclarationFunction(lines, functions[i]);
    }
    for(var i = 0; i < variables.length; i ++) {
      dtsRenderDeclarationVariable(lines, variables[i], 0);
    }
    dtsRenderImports(lines);
  }
  function dtsSortClasses(classes: DocEntry[]) {
    classes.sort((a: DocEntry, b: DocEntry) : number => {
      if(a.allTypes.indexOf(b.name) > -1) return 1;
      if(b.allTypes.indexOf(a.name) > -1) return -1;
      if(a.allTypes.length !== b.allTypes.length) {
        return a.allTypes.length > b.allTypes.length ? 1 : -1;
      }
      return  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }
  function dtsRenderImports(lines: string[]) {
    const modules: any = {};
    for(key in dtsImportDeclarations) {
      const entry: DocEntry = dtsImportDeclarations[key];
      let arr = modules[entry.moduleName];
      if(!arr) {
        arr = [];
        modules[entry.moduleName] = arr;
      }
      arr.push(key);
    }
    const importLines: string[] =[];
    for(key in modules) {
      const arr: string[] = modules[key];
      while(arr.length > 0) {
        const renderedArr = arr.splice(0, 5);
        let str = "import { " + renderedArr.join(", ") + " } from \"" + key + "\";";
        importLines.push(str);
      }
    }
    for(var key in dtsFrameworksImportDeclarations) {
      importLines.push(dtsFrameworksImportDeclarations[key] + " from \"" + key + "\";");
    }
    if(importLines.length > 0) {
      lines.unshift("");
    }
    for(let i = importLines.length - 1; i >= 0; i --) {
      lines.unshift(importLines[i]);
    }
  }
  function dtsRenderExportClassFromLibraries(lines: string[], entry: DocEntry) {
    if(!!dtsExportedClasses[entry.name]) return;
    dtsExportedClasses[entry.name] = true;
    let str = "export { "
    if(!!entry.className) {
      str += entry.className + " as ";
    }
    str += entry.name + " }";
    if(!!entry.fileName) {
      str += " from \"" + entry.fileName + "\"";
    }
    str += ";";
    lines.push(str);
  }
  function dtsRenderDeclarationClass(lines: string[], entry: DocEntry) {
    if(entry.name === "default") return;
    dtsRenderDoc(lines, entry);
    let line = "export declare ";
    line += "class " + entry.name + dtsGetTypeGeneric(entry.name) + dtsRenderClassExtend(entry) + " {";
    lines.push(line);
    dtsRenderDeclarationConstructor(lines, entry);
    dtsRenderDeclarationBody(lines, entry);
    lines.push("}");
  }
  function dtsRenderDeclarationInterface(lines: string[], entry: DocEntry) {
    dtsRenderDoc(lines, entry);
    const impl = dtsRenderImplementedInterfaces(entry, false);
    var line = "export interface " + dtsGetType(entry.name) + dtsGetTypeGeneric(entry.name) + impl +  " {";
    lines.push(line);
    dtsRenderDeclarationBody(lines, entry);
    lines.push("}");
  }
  function dtsRenderDeclarationVariable(lines: string[], entry: DocEntry, level: number) {
    dtsRenderDoc(lines, entry, level);
    var line = (level === 0 ? "export declare var " : dtsAddSpaces(level)) + entry.name + ": ";
    const hasMembers = Array.isArray(entry.members);
    const comma = level === 0 ? ";" : ",";
    line += hasMembers ? "{" : (dtsGetType(entry.type) + comma);
    lines.push(line);
    if(hasMembers) {
        for(var i = 0; i < entry.members.length; i ++) {
          if(dtsIsPrevMemberTheSame(entry.members, i)) continue;
          dtsRenderDeclarationVariable(lines, entry.members[i], level + 1);
        }
        lines.push(dtsAddSpaces(level) + "}" + comma);
    }
  }
  function dtsRenderDeclarationEnum(lines: string[], entry: DocEntry) {
    if(!Array.isArray(entry.members) || entry.members.length === 0) return;
    lines.push("export enum " + entry.name + " {");
    for(var i = 0; i < entry.members.length; i ++) {
      const m = entry.members[i];
      const comma = i < entry.members.length - 1 ? "," : "";
      lines.push(dtsAddSpaces() + m.name + (!!m.returnType ? " = " + m.returnType : "") + comma);
    }
    lines.push("}")
  }
  function dtsRenderDeclarationFunction(lines: string[], entry: DocEntry) {
    lines.push("export declare function " + dtsGetFunctionDeclaration(entry));
  }
  function dtsRenderClassExtend(cur: DocEntry): string {
    if(!cur.baseType) return "";
    if(!dtsGetHasClassType(cur.baseType)) return "";
    let entry: DocEntry = dtsDeclarations[cur.baseType];
    if(!entry) {
      entry = dtsImports[cur.baseType];
    }
    const isInteface = !!entry && entry.entryType === DocEntryType.interfaceType;
    const impl = dtsRenderImplementedInterfaces(cur, !isInteface);
    if(isInteface)
      return impl;
    const generic = dtsGetTypeGeneric(cur.baseType, cur.name);
    return  " extends " + cur.baseType + generic + impl;
  }
  function dtsRenderImplementedInterfaces(entry: DocEntry, isBaseClass: boolean): string {
    if(!Array.isArray(entry.implements)) return "";
    const impls = entry.implements;
    if(impls.length === 0) return "";
    const res = [];
    for(var i = 0; i < impls.length; i ++) {
      if(isBaseClass && impls[i] === entry.baseType) continue;
      const generic = dtsGetTypeGeneric(impls[i], entry.name);
      dtsAddImportDeclaration(impls[i]);
      res.push(impls[i] + generic);
    }
    if(res.length === 0) return "";
    const ext = entry.entryType === DocEntryType.interfaceType ?  " extends " : " implements ";
    return ext + res.join(", ");
  }
  function dtsRenderDeclarationBody(lines: string[], entry: DocEntry) {
    if(!Array.isArray(entry.members)) return;
    const members = [].concat(entry.members);
    for(var i = 0; i < members.length; i ++) {
      if(dtsIsPrevMemberTheSame(members, i)) continue;
      const member: DocEntry = members[i];
      dtsRenderDeclarationMember(lines, member);
      if(member.isLocalizable) {
        const name = "loc" + member.name[0].toUpperCase() + member.name.substring(1);
        if(dtsHasMemberInEntry(entry, name)) continue;
        const locMember = {name: name, type: "LocalizableString", hasSet: false, pmeType: "property"};
        dtsRenderDeclarationMember(lines, locMember);
      }
    }
  }
  function dtsHasMemberInEntry(entry: DocEntry, name: string): boolean {
    if(!Array.isArray(entry.members)) return;
    for(var i = 0; i < entry.members.length; i ++) {
      if(entry.members[i].name === name) return true;
    }
    return false;
  }
  function dtsRenderDeclarationConstructor(lines: string[], entry: DocEntry) {
    if(!Array.isArray(entry.constructors)) return;
    for(var i = 0; i < entry.constructors.length; i ++) {
      const parameters = dtsGetParameters(entry.constructors[i]);
      lines.push(dtsAddSpaces() + "constructor(" + parameters + ");");
    }
  }
  function dtsRenderDeclarationMember(lines: string[], member: DocEntry) {
    const prefix = dtsAddSpaces() + (member.isProtected ? "protected " : "") + (member.isStatic ? "static " : "");
    dtsRenderDoc(lines, member, 1);
    let importType = "";
    if(member.pmeType === "function" || member.pmeType === "method") {
      importType = member.returnType;
      lines.push(prefix + dtsGetFunctionDeclaration(member));
    }
    if(member.pmeType === "property") {
      const propType = dtsGetType(member.type);
      importType = member.type;
      if(member.isField) {
        lines.push(prefix + member.name + (member.isOptional ? "?" : "") + ": " + propType + ";");  
      } else {
        lines.push(prefix + "get " + member.name + "(): " + propType + ";");
        if(member.hasSet) {
          lines.push(prefix + "set " + member.name + "(val: " + propType + ");");
        }
      }
    }
    if(member.pmeType === "event") {
      importType = member.type;
      lines.push(prefix + member.name + ": " + member.type + ";");
    }
    dtsAddImportDeclaration(removeGenerics(importType));
  }
  function dtsGetFunctionDeclaration(entry: DocEntry) : string {
    const parStr = dtsGetFunctionParametersDeclaration(entry);
    return entry.name + dtsGetGenericTypes(entry.typeGenerics) + parStr + ";";
  }
  function dtsGetFunctionParametersDeclaration(entry: DocEntry, isParameter: boolean = false): string {
    let returnType = removeGenerics(entry.returnType);
    returnType = dtsGetType(returnType);
    if(returnType !== "any") {
      returnType += dtsGetGenericTypes(entry.returnTypeGenerics);
    }
    const parameters = dtsGetParameters(entry);
    return "(" + parameters + ")" + (isParameter ? " => " : ": ")  + returnType;
  }
  function removeGenerics(typeName: string): string {
    if(!typeName) return typeName;
    if(typeName[typeName.length - 1] !== ">") return typeName;
    const index = typeName.indexOf("<");
    if(index < 0) return typeName;
    return typeName.substring(0, index);
  }
  function dtsGetGenericTypes(generic: string[]): string {
    if(!Array.isArray(generic) || generic.length === 0) return "";
    return "<" + generic.join(", ") + ">";
  }
  function dtsRenderDoc(lines: string[], entry: DocEntry, level: number = 0) {
    if(!entry.documentation) return;
    const docLines = entry.documentation.split("\n");
    lines.push(dtsAddSpaces(level) + "/*");
    for(var i = 0; i < docLines.length; i ++) {
      lines.push(dtsAddSpaces(level) + "* " + docLines[i]);
    }
    lines.push(dtsAddSpaces(level) + "*/");
  }
  function dtsGetType(type: string): string {
    if(!type) return "void";
    if(type === "T") return type;
    if(type.indexOf("|") > -1) {
      return type.indexOf("(") > -1 ? "any" : type;
    }
    let str = type.replace("[", "").replace("]", "");
    if(str === "number" || str === "boolean" || str === "string" || str === "any" || str === "void") return type;
    if(type[0] === "(" && type.indexOf(callbackFuncResultStr) > -1) return dtsGetTypeAsFunc(type);
    return dtsPlatformType(str, type);
  }
  function dtsPlatformType(str: string, type: string): string {
    if(!dtsGetHasClassType(str)) return "any";
    if(isReactElement(type)) return "JSX.Element";
    return type;
  }
  function dtsGetTypeAsFunc(type: string): string {
    const index = type.indexOf(callbackFuncResultStr);
    const entry: DocEntry = {};
    entry.returnType = type.substring(index + callbackFuncResultStr.length);
    const paramsStr = type.substring(1, index).split(",");
    entry.parameters = [];
    for(var i = 0; i < paramsStr.length; i ++) {
      const par = paramsStr[i];
      const parIndex = par.indexOf(":");
      if(parIndex < 0)  return "any";
      entry.parameters.push({name: par.substring(0, parIndex).trim(), type: par.substring(parIndex + 1).trim() });
    } 
    return dtsGetFunctionParametersDeclaration(entry, true)
  }
  function dtsGetTypeGeneric(type: string, typeFor?: string): string {
    if(!type) return "";
    if(!typeFor) return dtsGetTypeGenericByParameters(dtsTypesParameters[type]);
    const args = dtsTypesArgumentParameters[type];
    if(!args) return "";
    return dtsGetTypeGenericByParameters(args[typeFor]);
  }
  function dtsGetTypeGenericByParameters(params: string[]): string {
    if(!Array.isArray(params)) return "";
    for(var i = 0; i < params.length; i ++) {
      dtsAddImportDeclaration(params[i]);
    }
    return "<" + params.join(", ") + ">";
  }
  function isReactElement(type: string): boolean {
    return isExportingReact && type === "Element";
  }
  function dtsGetHasClassType(type: string): boolean {
    if(dtsAddImportDeclaration(type)) return true;
    if(type === "Array") return true;
    if(isReactElement(type)) return true;
    return !!dtsDeclarations[type];
  }
  function dtsAddImportDeclaration(type: string): boolean {
    if(!type) return false;
    if(type.indexOf("React.") === 0) {
      dtsFrameworksImportDeclarations["react"] = "import * as React";
      isExportingReact = true;
      return true;
    }
    if(type === "Vue") {
      dtsFrameworksImportDeclarations["vue"] = "import Vue";
      return true;
    }
    if(!dtsExcludeImports && !!dtsDeclarations[type]) return false;
    const entry = dtsImports[type];
    if(!entry) return false;
    dtsImportDeclarations[type] = entry;
    return true;
  }
  function dtsIsPrevMemberTheSame(members: Array<DocEntry>, index: number): boolean {
    return index > 0 && members[index].name === members[index - 1].name;
  }
  function dtsGetParameters(member: DocEntry): string {
    if(!Array.isArray(member.parameters)) return "";
    let strs  = [];
    const params = member.parameters;
    for(var i = 0; i < params.length; i ++) {
      const p = params[i];
      let typeStr = dtsGetType(p.type);
      //We have Event in library core and there is Event in DOM.
      if(typeStr === "Event") typeStr = "any";
      strs.push(p.name + (p.isOptional ? "?" : "") + ": " + typeStr);
    }
    return strs.join(", ");
  }
  function dtsAddSpaces(level: number = 1): string {
    let str = "";
    for(var i = 0; i < level; i++) str+= "  ";
    return str;
  }
}
