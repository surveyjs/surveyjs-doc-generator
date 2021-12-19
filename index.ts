import * as ts from "typescript";
import * as fs from "fs";
enum DocEntryType {unknown, classType, interfaceType, functionType, variableType};
interface DocEntry {
  name?: string;
  entryType?: DocEntryType;
  className?: string;
  jsonName?: string;
  fileName?: string;
  documentation?: string;
  see?: any;
  type?: string;
  baseType?: string;
  allTypes?: string[];
  constructors?: DocEntry[];
  members?: DocEntry[];
  parameters?: DocEntry[];
  returnType?: string;
  pmeType?: string;
  hasSet?: boolean;
  isField?: boolean;
  isOptional?: boolean;
  jsonClassName?: string;
  isSerialized?: boolean;
  defaultValue?: any;
  serializedChoices?: any[];
}

var jsonObjMetaData: any = null;
export function setJsonObj(obj: any) {
  jsonObjMetaData = obj;
}

/** Generate documentation for all classes in a set of .ts files */
export function generateDocumentation(
  fileNames: string[],
  options: ts.CompilerOptions,
  docOptions: any = null
): void {
  // Build a program using the set of root file names in fileNames
  let program = ts.createProgram(fileNames, options);

  // Get the checker, we will use it to find more about classes
  let checker = program.getTypeChecker();

  let outputClasses: DocEntry[] = [];
  let outputPMEs: DocEntry[] = [];
  let pmesHash = {};
  let classesHash = {};
  let curClass: DocEntry = null;
  let curJsonName: string = null;
  let generateJSONDefinitionClasses = {};
  let generateJSONDefinition =
    !!docOptions && docOptions.generateJSONDefinition === true;
  let generateDocs = !docOptions || (!!docOptions && docOptions.generateDoc !== false);
  let dtsFileName = !!docOptions ? docOptions.dtsFileName : undefined;
  let generateDts = !!dtsFileName;
  let outputDefinition = {};
  let dtsImports = {};
  let dtsDeclarations = {};

  // Visit every sourceFile in the program
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName.indexOf("node_modules") > 0) continue;
    // Walk the tree to search for classes
    ts.forEachChild(sourceFile, visit);
  }
  for (var key in classesHash) {
    setAllParentTypes(key);
  }
  if(generateDocs) {
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
    fs.writeFileSync(process.cwd() + "\\" + dtsFileName, getDtsText());
}

  return;

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
    if (!cur.baseType) return;
    var baseClass = classesHash[cur.baseType];
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
        if (isSymbolHasComments(symbol)) {
          visitVariableNode(varNode, symbol);
        }
      }
    } else if (node.kind === ts.SyntaxKind.ClassDeclaration) {
      // This is a top level class, get its symbol
      let symbol = checker.getSymbolAtLocation(
        (<ts.ClassDeclaration>node).name
      );
      if (isSymbolHasComments(symbol)) {
        visitDocumentedNode(node, symbol);
      }
    } else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      // This is a top level class, get its symbol
      let symbol = checker.getSymbolAtLocation(
        (<ts.InterfaceDeclaration>node).name
      );
      if (isSymbolHasComments(symbol)) {
        visitDocumentedNode(node, symbol);
      }
    } else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
      // This is a namespace, visit its children
      ts.forEachChild(node, visit);
    }
  }
  function visitVariableNode(node: ts.VariableDeclaration, symbol: ts.Symbol) {
    const entry = serializeSymbol(symbol);
    entry.entryType = DocEntryType.variableType;
    dtsDeclarations[entry.name] = entry;
    visitVariableProperties(entry, node);
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
      visitVariableProperties(memberEntry, <ts.VariableDeclaration>node);
    }
  }
  function visitDocumentedNode(node: ts.Node, symbol: ts.Symbol) {
    curClass = serializeClass(symbol, node);
    classesHash[curClass.name] = curClass;
    outputClasses.push(curClass);
    curJsonName = null;
    ts.forEachChild(node, visitClassNode);

    if (!curJsonName) return;
    curClass.jsonName = curJsonName;
    if (!jsonObjMetaData) return;
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
    if (!isPMENodeExported(node)) return;
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
    if (symbol) {
      var ser = serializeMethod(symbol, node);
      let fullName = ser.name;
      if (curClass) {
        ser.className = curClass.name;
        ser.jsonName = curClass.jsonName;
        fullName = curClass.name + "." + fullName;
        if(!curClass.members) curClass.members = [];
        curClass.members.push(ser);
      }
      ser.pmeType = getPMEType(node.kind);
      if(node.kind === ts.SyntaxKind.PropertySignature) {
        ser.isField = true;
        ser.isOptional = checker.isOptionalParameter(<any>node);
      }
      if (ser.type.indexOf("Event") === 0) ser.pmeType = "event";
      if (node.kind === ts.SyntaxKind.GetAccessor) {
        let serSet = pmesHash[fullName];
        if (serSet) {
          ser.hasSet = serSet.hasSet;
        } else ser.hasSet = false;
      }
      if (node.kind === ts.SyntaxKind.SetAccessor) {
        let serGet = pmesHash[fullName];
        if (serGet) serGet.hasSet = true;
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
      if (isSymbolHasComments(symbol)) {
      }
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
  function getPMEType(nodeKind: ts.SyntaxKind) {
    if (nodeKind === ts.SyntaxKind.MethodDeclaration) return "method";
    if (nodeKind === ts.SyntaxKind.FunctionDeclaration) return "function";
    return "property";
  }
  function getTypeOfSymbol(symbol: ts.Symbol): ts.Type {
    if (symbol.valueDeclaration)
      return checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    return checker.getDeclaredTypeOfSymbol(symbol);
  }
  /** Serialize a symbol into a json object */

  function serializeSymbol(symbol: ts.Symbol): DocEntry {
    var type = getTypeOfSymbol(symbol);
    var res = {
      name: symbol.getName(),
      documentation: ts.displayPartsToString(symbol.getDocumentationComment()),
      type: checker.typeToString(type),
    };
    var jsTags = symbol.getJsDocTags();
    if (jsTags) {
      var seeArray = [];
      for (var i = 0; i < jsTags.length; i++) {
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
    details.constructors = constructorType
      .getConstructSignatures()
      .map(serializeSignature);

    //get base class
    details.baseType = "";
    const classDeclaration = <ts.ClassDeclaration>node;
    if (
      classDeclaration &&
      classDeclaration.heritageClauses &&
      classDeclaration.heritageClauses.length > 0
    ) {
      const firstHeritageClause = classDeclaration.heritageClauses[0];
      const firstHeritageClauseType = firstHeritageClause.types[0];
      const extendsType = checker.getTypeAtLocation(
        firstHeritageClauseType.expression
      );
      if (extendsType) {
        details.baseType = extendsType.symbol.name;
      }
    }
    return details;
  }

  /** Serialize a method symbol infomration */
  function serializeMethod(symbol: ts.Symbol, node: ts.Node) {
    let details = serializeSymbol(symbol);
    if (
      node.kind === ts.SyntaxKind.MethodDeclaration ||
      node.kind === ts.SyntaxKind.FunctionDeclaration
    ) {
      let signature = checker.getSignatureFromDeclaration(
        <ts.SignatureDeclaration>node
      );
      let funDetails = serializeSignature(signature);
      details.parameters = funDetails.parameters;
      details.returnType = funDetails.returnType;
    }
    return details;
  }

  /** Serialize a signature (call or construct) */
  function serializeSignature(signature: ts.Signature) {
    const params = signature.parameters;
    const res = {
      parameters: params.map(serializeSymbol),
      returnType: checker.typeToString(signature.getReturnType()),
      documentation: ts.displayPartsToString(
        signature.getDocumentationComment()
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

  /** True if this is visible outside this file, false otherwise */
  function isNodeExported(node: ts.Node): boolean {
    return (
      (node.flags & ts.NodeFlags["Export"]) !== 0 ||
      (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }
  function isPMENodeExported(node: ts.Node): boolean {
    let modifier = ts.getCombinedModifierFlags(node);
    if ((modifier & ts.ModifierFlags.Public) !== 0) return true;
    if(node.kind === ts.SyntaxKind.PropertyDeclaration) return true;
    var parent = node.parent;
    return parent && parent.kind === ts.SyntaxKind.InterfaceDeclaration;
  }
  /** True if there is a comment before declaration */
  function isSymbolHasComments(symbol: ts.Symbol): boolean {
    let com = symbol.getDocumentationComment();
    return com && com.length > 0;
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
  function getReferenceType(type: string): any {
    var curClass = classesHash[type];
    if (!curClass) return type;
    return { $href: "#" + curClass.jsonName };
  }
  function prepareDtsInfo() {
    for(var key in classesHash) {
      proccessDtsClass(classesHash[key]);
    }
  }
  function proccessDtsClass(curClass: DocEntry) {
    dtsDeclarations[curClass.name] = curClass;
    proccessDtsClassMembers(curClass);
  }
  function proccessDtsClassMembers(curClass: DocEntry) {

  }
  function getDtsText(): string {
    const lines = [];
    getDtsImports(lines);
    getDtsDeclarations(lines);
    return lines.join("\n");
  }
  function getDtsImports(lines: string[]) {

  }
  function getDtsDeclarations(lines: string[]) {
    const classes = [];
    const interfaces = [];
    const variables = [];

    for(var key in dtsDeclarations) {
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
  }
    classes.sort((a: DocEntry, b: DocEntry) : number => {
      if(a.allTypes.indexOf(b.name) > -1) return 1;
      if(b.allTypes.indexOf(a.name) > -1) return -1;
      if(a.allTypes.length !== b.allTypes.length) {
        return a.allTypes.length > b.allTypes.length ? 1 : -1;
      }
      return  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    for (var i = 0; i < interfaces.length; i++) {
      getDtsDeclarationInterface(lines, interfaces[i]);
    }
    for(var i = 0; i < classes.length; i ++) {
      getDtsDeclarationClass(lines, classes[i]);
    }
    for(var i = 0; i < variables.length; i ++) {
      getDtsDeclarationVariable(lines, variables[i], 0);
    }
  }
  function getDtsDeclarationClass(lines: string[], entry: DocEntry) {
    let line = "export declare ";
    line += "class " + entry.name + getDtsClassExtend(entry) + " {";
    lines.push(line);
    getDtsDeclarationBody(lines, entry);
    lines.push("}");
  }
  function getDtsDeclarationInterface(lines: string[], entry: DocEntry) {
    var line = "export interface " + entry.name + " {";
    lines.push(line);
    getDtsDeclarationBody(lines, entry);
    lines.push("}");
  }
  function getDtsDeclarationVariable(lines: string[], entry: DocEntry, level: number) {
    var line = (level === 0 ? "export declare var " : addTabs(level)) + entry.name + ": ";
    const hasMembers = Array.isArray(entry.members);
    line += hasMembers ? "{" : (getDtsType(entry.type) + ";");
    lines.push(line);
    if(hasMembers) {
        for(var i = 0; i < entry.members.length; i ++) {
          if(isDtsPrevMemberTheSame(entry, i)) continue;
          getDtsDeclarationVariable(lines, entry.members[i], level + 1);
        }
        lines.push(addTabs(level) + "}")
    }
  }
  function getDtsClassExtend(curClass: DocEntry): string {
    if(!curClass.baseType || !dtsDeclarations[curClass.baseType]) return "";
    return  " extends " + curClass.baseType;
  }
  function getDtsDeclarationBody(lines: string[], entry: DocEntry) {
    if(!entry.members) return;
    for(var i = 0; i < entry.members.length; i ++) {
      if(isDtsPrevMemberTheSame(entry, i)) continue;
      const member = entry.members[i];
      if(hasDtsMemberInBaseClasses(entry, member.name)) continue;
      getDtsDeclarationMember(lines, member);
    }
  }
  function getDtsDeclarationMember(lines: string[], member: DocEntry) {
    if(member.pmeType === "function" || member.pmeType === "method") {
      const returnType = getDtsType(member.returnType);
      const parameters = getDtsParameters(member);
      lines.push(addTabs() + member.name + "(" + parameters + "): " + returnType + ";");
    }
    if(member.pmeType === "property") {
      const propType = getDtsType(member.type);
      if(member.isField) {
        lines.push(addTabs() + member.name + (member.isOptional ? "?" : "") + ": " + propType + ";");  
      } else {
        lines.push(addTabs() + "get " + member.name + "(): " + propType + ";");
        if(member.hasSet) {
          lines.push(addTabs() + "set " + member.name + "(val: " + propType + ");");
        }
      }
    }
  }
  function getDtsType(type: string): string {
    if(!type) return "void";
    if(type.indexOf("|") > -1) {

      return type.indexOf("(") > -1 ? "any" : type;
    }
    let str = type.replace("[", "").replace("]", "");
    if(str === "number" || str === "boolean" || str === "string" || str === "any" || str === "void") return type;
    if(dtsDeclarations[str]) return type;
    return "any"
  }
  function isDtsPrevMemberTheSame(entry: DocEntry, index: number): boolean {
    return index > 0 && entry.members[index].name === entry.members[index - 1].name;
  }
  function getDtsParameters(member: DocEntry): string {
    if(!Array.isArray(member.parameters)) return "";
    let strs  = [];
    const params = member.parameters;
    for(var i = 0; i < params.length; i ++) {
      const p = params[i];
      strs.push(p.name + (p.isOptional ? "?" : "") + ": " + getDtsType(p.type));
    }
    return strs.join(", ");
  }
  function hasDtsMemberInBaseClasses(entry: DocEntry, name: string): boolean {
    if(!Array.isArray(entry.allTypes)) return false;
    for(var i = 1; i < entry.allTypes.length; i ++) {
      if(hasDtsMember(dtsDeclarations[entry.allTypes[i]], name)) return true;
    }
    return false;
  }
  function hasDtsMember(entry: DocEntry, name: string): boolean {
    if(!entry.members) return false;
    for(var i = 0; i < entry.members.length; i ++) {
      if(entry.members[i].name === name) return true;
    }
    return false;
  }
  function addTabs(level: number = 1): string {
    let str = "";
    for(var i = 0; i < level; i++) str+= "\t\t";
    return str;
  }
}
