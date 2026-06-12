import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const EventDescriptReplacedText = "For information on event handler parameters, refer to descriptions within the interface.";
const SurveyModelSenderDescription = "A survey instance that raised the event.";
const CreatorModelSenderDescription = "A Survey Creator instance that raised the event.";


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
  isDeprecated?: boolean;
  deprecationInfo?: string;
  see?: any;
  type?: string;
  baseType?: string;
  implements?: string[];
  allTypes?: string[];
  constructors?: DocEntry[];
  members?: DocEntry[];
  parameters?: DocEntry[];
  returnType?: string;
  returnDocumentation?: string;
  returnTypeGenerics?: string[];
  hideForClasses?: string[];
  isHidden?: boolean;
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
  eventSenderName?: string;
  eventOptionsName?: string;
}
var jsonObjMetaData: any = null;
const stringLiteralTypes: any = {};
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

/** Generate documentation for all classes in a set of .ts files */
export function generateDocumentation(
  fileNames: string[], options: ts.CompilerOptions, docOptions: any = {}
): void {
  let vueGeneratedFiles = [];
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
  let generateJSONDefinition = docOptions.generateJSONDefinition === true;
  let outputDefinition = {};
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
  updateEventsDocumentation();
  updateHiddenForEntriesDoc();
  // print out the doc
  fs.writeFileSync(
    process.cwd() + "/docs/classes.json",
    JSON.stringify(outputClasses, undefined, 4)
  );
  fs.writeFileSync(
    process.cwd() + "/docs/pmes.json",
    JSON.stringify(outputPMEs, undefined, 4)
  );
  if (generateJSONDefinition) {
    outputDefinition["$schema"] = "http://json-schema.org/draft-07/schema#";
    outputDefinition["title"] = "SurveyJS Library json schema";
    addClassIntoJSONDefinition("SurveyModel", true);
    fs.writeFileSync(
      process.cwd() + "/docs/surveyjs_definition.json",
      JSON.stringify(outputDefinition, undefined, 4)
    );
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
        vueGeneratedFiles.push(absFileName);
        fs.writeFileSync(absFileName, vue_tsText);
      }
    }
  }
  function deleteVueTSFiles() {
    for(var i = 0; i < vueGeneratedFiles.length; i ++) {
      fs.unlinkSync(vueGeneratedFiles[i]);
    }
  }
  function isNonEnglishLocalizationFile(fileName: string): boolean {
    const dir = path.dirname(fileName);
    const name = path.basename(fileName);
    if(name === "english") return false;
    const loc = "localization";
    return dir.lastIndexOf(loc) > dir.length - loc.length - 3;
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
    if (node.kind === ts.SyntaxKind.VariableStatement) {
      const vsNode = <ts.VariableStatement>node;
      if(vsNode.declarationList.declarations.length > 0) {
        const varNode = vsNode.declarationList.declarations[0];
        let symbol = checker.getSymbolAtLocation(
          (<ts.VariableDeclaration>varNode).name
        );
        if (!!symbol && isSymbolHasComments(symbol)) {
          visitVariableNode(varNode, symbol);
        }
      }
    } else if (node.kind === ts.SyntaxKind.ClassDeclaration) {
      // This is a top level class, get its symbol
      let symbol = checker.getSymbolAtLocation(
        (<ts.ClassDeclaration>node).name
      );
      if(!symbol) return;
      if (isSymbolHasComments(symbol)) {
        visitDocumentedNode(node, symbol);
      }
    } else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      // This is a top level class, get its symbol
      const name = (<ts.InterfaceDeclaration>node).name;
      let symbol = checker.getSymbolAtLocation(name);
      if (isSymbolHasComments(symbol) || isOptionsInterface(name.text)) {
        visitDocumentedNode(node, symbol);
      }
    } else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
      // This is a namespace, visit its children
      ts.forEachChild(node, visit);
    } else if(node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
      visitExportTypeAliasNode(<ts.TypeAliasDeclaration>node);
    }
  }
  function visitExportTypeAliasNode(node: ts.TypeAliasDeclaration) {
    const type = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(node.name));
    const types = (<any>type).types;
    if(Array.isArray(types) && types.length > 0) {
      const literals = [];
      for(let i = 0; i < types.length; i ++) {
        if(typeof types[i].value === "string") {
          literals.push("\"" + types[i].value + "\"");
        }
      }
      if(types.length === literals.length) {
        stringLiteralTypes[node.name.text] = literals.join(" | ");
      }
    }
  }
  function visitVariableNode(node: ts.VariableDeclaration, symbol: ts.Symbol) {
    const entry = serializeSymbol(symbol);
    entry.entryType = DocEntryType.variableType;
    visitVariableProperties(entry, node);
    entry.allTypes = [entry.name];
    entry.isPublic = true;
    outputClasses.push(entry);
    entry.members = [];
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
      if(entry.entryType === DocEntryType.variableType) {
          outputPMEs.push(memberEntry);
          memberEntry.className = entry.name;
          memberEntry.pmeType = "property";
          memberEntry.isPublic = true;
          memberEntry.isField = true,
          memberEntry.hasSet = true;
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
    if (!jsonObjMetaData) return;
    const properties = jsonObjMetaData.getProperties(curJsonName);
    const classInfo = jsonObjMetaData.findClass(curJsonName);
    const hiddenProps = {};
    const parentHiddenClasses = [];
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];
      if (prop.visible === false && !!classInfo.parentName) {
        let parentClassInfo = jsonObjMetaData.findClass(classInfo.parentName);
        let parentProp = jsonObjMetaData.findProperty(parentClassInfo.name, prop.name);
        while (parentClassInfo && parentClassInfo.parentName && !!parentProp && parentProp === prop) {
          parentClassInfo = jsonObjMetaData.findClass(parentClassInfo.parentName);
          parentProp = jsonObjMetaData.findProperty(parentClassInfo.name, prop.name);
        }
        if (parentProp && parentProp.visible !== false) {
          parentClassInfo = jsonObjMetaData.findClass(parentClassInfo.name);
          while (parentClassInfo && parentClassInfo.parentName && !!jsonObjMetaData.findProperty(parentClassInfo.parentName, prop.name)) {
            parentClassInfo = jsonObjMetaData.findClass(parentClassInfo.parentName);
          }
          if (parentHiddenClasses.indexOf(parentClassInfo.name) < 0) {
            parentHiddenClasses.push(parentClassInfo.name);
          }
          hiddenProps[prop.name] = parentClassInfo.name;
        }
      }
    }
    for (let i = 0; i < outputPMEs.length; i++) {
      const pme = outputPMEs[i];
      if (pme.pmeType !== "property") continue;
      if (parentHiddenClasses.length > 0 && classesHash[pme.className]) {
        const pmeJsonName = pme.jsonName || classesHash[pme.className].jsonName;
        if (parentHiddenClasses.indexOf(pmeJsonName) > -1) {
          if (hiddenProps[pme.name] === pmeJsonName) {
            if (!Array.isArray(pme.hideForClasses)) {
              pme.hideForClasses = [];
            }
            pme.hideForClasses.push(curClass.name);
          }
        }
      }
      if (pme.className == curClass.name) {
        const prop = jsonObjMetaData.findProperty(curJsonName, pme.name);
        if (!!prop) {
          pme.isSerialized = prop.isSerializable !== false;
          if (prop.defaultValue) {
            pme.defaultValue = prop.defaultValue;
          }
          if (prop.choices) {
            pme.serializedChoices = prop.choices;
          }
          if (prop.className) {
            pme.jsonClassName = prop.className;
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
      if (!hasMembers(curClass, ser.name)) {
        curClass.members.push(ser);
      }
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
      //if (!ser.documentation && (ser.eventSenderName === "__type" || !ser.eventOptionsName)) {
      //Remove any event if there is no documentation 
      if (!ser.documentation) {
        ser = null;
      }
    }
    if (ser && node.kind === ts.SyntaxKind.GetAccessor) {
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
  function hasMembers(entry: DocEntry, name: string): boolean {
    if(!entry || !Array.isArray(entry.members)) return false;
    for(var i = 0; i < entry.members.length; i ++) {
      if(entry.members[i].name === name) return true;
    }
    return false;
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
    ser.eventSenderName = getSymbolName(args[args.length - 2].symbol);
    ser.eventOptionsName = getSymbolName(args[args.length - 1].symbol);
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
    const res: any = {
      name: symbol.getName(),
      documentation: !!docParts ? ts.displayPartsToString(docParts) : "",
      type: checker.typeToString(type),
      isPublic: isPublic
    };
    if(stringLiteralTypes[res.type]) {
      res.type = stringLiteralTypes[res.type];
    }
    if(!!type.symbol && !!type.symbol.valueDeclaration && type.symbol.valueDeclaration.kind === ts.SyntaxKind.FunctionExpression) {
      const signature = checker.getSignatureFromDeclaration(<ts.SignatureDeclaration>type.symbol.valueDeclaration);
      const funDetails = serializeSignature(signature);
      if(funDetails && Array.isArray(funDetails.parameters)) {
          res.parameters = funDetails.parameters
      }
  }
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
        if (jsTags[i].name == "deprecated") {
          res.isDeprecated = true;
          let text = jsTags[i].text;
          if(!!text) {
            text = text.trim();
            if(text) {
              text = "Obsolete. " + text;
            }
          }
          if(!!text) {
            res.deprecationInfo = text;
          }
        }
        if (jsTags[i].name == "see") {
          seeArray.push(jsTags[i].text);
        }
        if (jsTags[i].name == "returns") {
          res["returnDocumentation"] = jsTags[i].text;
        }
        if (jsTags[i].name == "hidden") {
          res.isHidden = true;
        }
        if (jsTags[i].name == "hidefor") {
          const hideFor = jsTags[i].text;
          if(!!hideFor) {
            const hideForVal = hideFor.split(",").map((item: string) => item.trim());
            if(hideForVal.length > 0) {
              res["hideForClasses"] = hideForVal;
            }
          }
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
      }
    }
  }
  function getBaseType(firstHeritageClauseType: ts.ExpressionWithTypeArguments): string {
    if(!firstHeritageClauseType) return "";
    const expression: any = firstHeritageClauseType.expression;
    // Handle mixin pattern: extends mixinFunction(BaseClass)
    if(expression.kind === ts.SyntaxKind.CallExpression && expression.arguments && expression.arguments.length > 0) {
      const arg = expression.arguments[0];
      const argType = checker.getTypeAtLocation(arg);
      if(argType && argType.symbol) {
        return argType.symbol.name;
      }
      if(arg.escapedText) return arg.escapedText;
      if(arg.text) return arg.text;
      return "";
    }
    const extendsType = checker.getTypeAtLocation(
      firstHeritageClauseType.expression
    );
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
    if (entry.parameters && entry.parameters.length > 0) {
      addNestedParameters(entry.parameters, node);
    }
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
  function addNestedParameters(parameters: DocEntry[], node: any) {
    if (node.jsDoc && node.jsDoc.length > 0) {
      const jsDoc = node.jsDoc[0];
      if (jsDoc.tags) {
        jsDoc.tags.forEach((tag: any) => {
          if (tag.tagName.text === "param" && tag.typeExpression && tag.name && tag.name.left && tag.name.right) {
            const paramName = tag.name.left.text;
            const nextedParam = tag.name.right.text;
            const paramType = checker.getTypeAtLocation(tag.typeExpression.type);
            parameters.push({ name: paramName + "." + nextedParam, type: checker.typeToString(paramType), documentation: tag.comment });
          }
        });
      }
    }
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
      if(!ser.eventSenderName || !ser.eventOptionsName || ser.eventOptionsName === "__type") continue;
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
  function updateHiddenForEntriesDoc() {
    const addedEntries: DocEntry[] = [];
    for(let i = 0; i < outputPMEs.length; i ++) {
      const ser = outputPMEs[i];
      if(Array.isArray(ser.hideForClasses)) {
        ser.hideForClasses.forEach((className: string) => {
          hideEntryForClass(ser, className, addedEntries);
        });
      }
      if(ser.isHidden === true && !!ser.className) {
        outputClasses.forEach((cls: DocEntry) => {
          if(cls.name !== ser.className && Array.isArray(cls.allTypes)
            && cls.allTypes.indexOf(ser.className) > -1) {
            hideEntryForClass(ser, cls.name, addedEntries);
          }
        });
      }
    }
    addedEntries.forEach((entry: DocEntry) => {
      outputPMEs.push(entry);
    });
  }
  function hideEntryForClass(ser: DocEntry, className: string, addedEntries: DocEntry[]) {
    const classEntry = classesHash[className];
    if(!classEntry) return;
    if(!Array.isArray(classEntry.members)) {
      classEntry.members = [];
    }
    let entry = classEntry.members.find((item: DocEntry) => item.name === ser.name);
    if(!entry) {
      entry = JSON.parse(JSON.stringify(ser));
      classEntry.members.push(entry);
      addedEntries.push(entry);
    }
    entry.className = className;
    entry.isHidden = true;
    entry.documentation = "";
  }
  function updateEventDocumentationSender(ser: DocEntry, lines: Array<string>) {
    if(!ser.eventSenderName) return;
    let desc = "";
    if(ser.eventSenderName === "SurveyModel") {
      desc = SurveyModelSenderDescription;
    }
    if(ser.eventSenderName.indexOf("Creator")  > -1) {
      desc = CreatorModelSenderDescription;
    }
    lines.push(" - `sender`: `"+ ser.eventSenderName + "`" +  (!!desc ? "  " : ""));
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
      if(m.isHidden === true || isHiddenEntryByDoc(doc)) continue;
      lines.push("- `options." + m.name + "`: `" + m.type + "`" +  (!!doc ? "  " : ""));
      if(!!doc) {
        lines.push(doc);
      }
    };
  }
  function isHiddenEntryByDoc(doc: string): boolean {
    if(!doc) return true;
    doc = doc.toLocaleLowerCase();
    return doc.startsWith("obsolete") || doc.startsWith("for internal use");
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
}
