var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  generateDocumentation: () => generateDocumentation,
  generateMDFiles: () => generateMDFiles,
  setJsonObj: () => setJsonObj
});
module.exports = __toCommonJS(index_exports);

// src/state.ts
var jsonObjMetaData = null;
var stringLiteralTypes = {};
function setJsonObj(obj) {
  jsonObjMetaData = obj;
}

// src/generator.ts
var ts5 = __toESM(require("typescript"));
var fs4 = __toESM(require("fs"));

// src/options.ts
var ts = __toESM(require("typescript"));
var tsDefaultOptions = {
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
function getTsOptions(options) {
  const res = {};
  for (key in tsDefaultOptions) res[key] = tsDefaultOptions[key];
  for (var key in options) res[key] = options[key];
  return res;
}

// src/file-utils.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function printError(text) {
  console.log(text);
}
function checkFiles(fileNames, errorText) {
  if (!Array.isArray(fileNames)) {
    printError("file list is empty");
    return false;
  }
  for (var i = 0; i < fileNames.length; i++) {
    const absFileName = getAbsoluteFileName(fileNames[i]);
    if (!fs.existsSync(absFileName)) {
      printError(errorText + ": " + absFileName);
      return false;
    }
  }
  return true;
}
function getAbsoluteFileName(name) {
  return path.join(process.cwd(), name);
}

// src/vue-files.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
function generateVueTSFiles(ctx, fileNames) {
  for (var i = 0; i < fileNames.length; i++) {
    const fn = fileNames[i];
    let text = fs2.readFileSync(getAbsoluteFileName(fn), "utf8");
    const dir = path2.dirname(fn);
    generateVueTSFile(ctx, text, dir);
    const matchArray = text.match(/(?<=export \* from ")(.*)(?=";)/gm);
    if (!Array.isArray(matchArray)) continue;
    for (var i = 0; i < matchArray.length; i++) {
      const fnChild = path2.join(dir, matchArray[i] + ".ts");
      const absFnChild = getAbsoluteFileName(fnChild);
      if (!fs2.existsSync(absFnChild)) return;
      text = fs2.readFileSync(absFnChild, "utf8");
      generateVueTSFile(ctx, text, dir);
    }
  }
}
function generateVueTSFile(ctx, text, dir) {
  const matchArray = text.match(/(?<=")(.*)(?=.vue";)/gm);
  if (!Array.isArray(matchArray)) return;
  for (var i = 0; i < matchArray.length; i++) {
    const fileName = path2.join(dir, matchArray[i] + ".vue");
    if (!fs2.existsSync(fileName)) continue;
    let absFileName = getAbsoluteFileName(fileName);
    const vueText = fs2.readFileSync(absFileName, "utf8");
    const startStr = '<script lang="ts">';
    const endStr = "</script>";
    const startIndex = vueText.indexOf(startStr) + startStr.length;
    const endIndex = vueText.lastIndexOf(endStr);
    if (endIndex > startIndex && startIndex > 0) {
      const vue_tsText = vueText.substring(startIndex, endIndex);
      absFileName += ".ts";
      ctx.vueGeneratedFiles.push(absFileName);
      fs2.writeFileSync(absFileName, vue_tsText);
    }
  }
}
function deleteVueTSFiles(ctx) {
  for (var i = 0; i < ctx.vueGeneratedFiles.length; i++) {
    fs2.unlinkSync(ctx.vueGeneratedFiles[i]);
  }
}
function isNonEnglishLocalizationFile(fileName) {
  const dir = path2.dirname(fileName);
  const name = path2.basename(fileName);
  if (name === "english") return false;
  const loc = "localization";
  return dir.lastIndexOf(loc) > dir.length - loc.length - 3;
}

// src/inheritance.ts
function setAllParentTypes(ctx, className) {
  if (!className) return;
  var cur = ctx.classesHash[className];
  if (cur.allTypes && cur.allTypes.length > 0) return;
  setAllParentTypesCore(ctx, cur);
}
function setAllParentTypesCore(ctx, cur) {
  cur.allTypes = [];
  cur.allTypes.push(cur.name);
  if (cur.entryType === 2 /* interfaceType */ && Array.isArray(cur.implements)) {
    cur.implements.forEach((item) => addBaseAllTypesIntoCur(ctx, cur, item));
  }
  if (!cur.baseType) return;
  addBaseAllTypesIntoCur(ctx, cur, cur.baseType);
}
function addBaseAllTypesIntoCur(ctx, cur, className) {
  if (!className) return;
  var baseClass = ctx.classesHash[className];
  if (!baseClass) return;
  if (!baseClass.allTypes) {
    setAllParentTypesCore(ctx, baseClass);
  }
  for (var i = 0; i < baseClass.allTypes.length; i++) {
    cur.allTypes.push(baseClass.allTypes[i]);
  }
}

// src/visitor.ts
var ts4 = __toESM(require("typescript"));

// src/ast-utils.ts
var ts2 = __toESM(require("typescript"));
function hasMembers(entry, name) {
  if (!entry || !Array.isArray(entry.members)) return false;
  for (var i = 0; i < entry.members.length; i++) {
    if (entry.members[i].name === name) return true;
  }
  return false;
}
function getJsonTypeName(node) {
  let body = node.getFullText();
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
function isSurveyEventType(type) {
  return !!type && (type.indexOf("Event") === 0 || type.indexOf("CreatorEvent") === 0);
}
function getPMEType(nodeKind) {
  if (nodeKind === ts2.SyntaxKind.MethodDeclaration || nodeKind === ts2.SyntaxKind.MethodSignature) return "method";
  if (nodeKind === ts2.SyntaxKind.FunctionDeclaration) return "function";
  return "property";
}
function isNodeExported(node) {
  return (node.flags & ts2.NodeFlags["Export"]) !== 0 || node.parent && node.parent.kind === ts2.SyntaxKind.SourceFile;
}
function isPMENodeExported(node, symbol) {
  let modifier = ts2.getCombinedModifierFlags(node);
  if ((modifier & ts2.ModifierFlags.Public) !== 0) return true;
  if (node.kind === ts2.SyntaxKind.PropertyDeclaration) return true;
  if (isSymbolHasComments(symbol)) return true;
  var parent = node.parent;
  return parent && parent.kind === ts2.SyntaxKind.InterfaceDeclaration;
}
function isSymbolHasComments(symbol) {
  let com = symbol.getDocumentationComment(void 0);
  return com && com.length > 0;
}
function isOptionsInterface(name) {
  return name.indexOf("Options") > -1 || name.indexOf("Event") > -1;
}

// src/serializer.ts
var ts3 = __toESM(require("typescript"));
function getTypeOfSymbol(ctx, symbol) {
  if (symbol.valueDeclaration)
    return ctx.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
  return ctx.checker.getDeclaredTypeOfSymbol(symbol);
}
function updateEventOptionInterfaceName(ctx, node, ser) {
  const typeObj = ctx.checker.getTypeAtLocation(node);
  if (!typeObj) return;
  const args = typeObj.typeArguments;
  if (!Array.isArray(args) || args.length < 2) return;
  ser.eventSenderName = getSymbolName(args[args.length - 2].symbol);
  ser.eventOptionsName = getSymbolName(args[args.length - 1].symbol);
}
function getSymbolName(symbol) {
  return !!symbol && !!symbol.name ? symbol.name : "";
}
function serializeSymbol(ctx, symbol) {
  const checker = ctx.checker;
  const type = getTypeOfSymbol(ctx, symbol);
  const docParts = symbol.getDocumentationComment(void 0);
  const modifiedFlag = !!symbol.valueDeclaration ? ts3.getCombinedModifierFlags(symbol.valueDeclaration) : 0;
  const isPublic = (modifiedFlag & ts3.ModifierFlags.Public) !== 0;
  const res = {
    name: symbol.getName(),
    documentation: !!docParts ? ts3.displayPartsToString(docParts) : "",
    type: checker.typeToString(type),
    isPublic
  };
  if (stringLiteralTypes[res.type]) {
    res.type = stringLiteralTypes[res.type];
  }
  if (!!type.symbol && !!type.symbol.valueDeclaration && type.symbol.valueDeclaration.kind === ts3.SyntaxKind.FunctionExpression) {
    const signature = checker.getSignatureFromDeclaration(type.symbol.valueDeclaration);
    const funDetails = serializeSignature(ctx, signature);
    if (funDetails && Array.isArray(funDetails.parameters)) {
      res.parameters = funDetails.parameters;
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
        if (!!text) {
          text = text.trim();
          if (text) {
            text = "Obsolete. " + text;
          }
        }
        if (!!text) {
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
        if (!!hideFor) {
          const hideForVal = hideFor.split(",").map((item) => item.trim());
          if (hideForVal.length > 0) {
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
function serializeClass(ctx, symbol, node) {
  let details = serializeSymbol(ctx, symbol);
  details.implements = getImplementedTypes(ctx, node, details.name);
  if (node.kind === ts3.SyntaxKind.InterfaceDeclaration) {
    details.entryType = 2 /* interfaceType */;
  }
  if (node.kind !== ts3.SyntaxKind.ClassDeclaration) return details;
  let constructorType = ctx.checker.getTypeOfSymbolAtLocation(
    symbol,
    symbol.valueDeclaration
  );
  details.entryType = 1 /* classType */;
  details.constructors = getConstructors(ctx, constructorType);
  createPropertiesFromConstructors(details);
  const firstHeritageClauseType = getFirstHeritageClauseType(node);
  details.baseType = getBaseType(ctx, firstHeritageClauseType);
  return details;
}
function getConstructors(ctx, constructorType) {
  const res = [];
  const signitures = constructorType.getConstructSignatures();
  for (var i = 0; i < signitures.length; i++) {
    if (!signitures[i].declaration) continue;
    res.push(serializeSignature(ctx, signitures[i]));
  }
  return res;
}
function createPropertiesFromConstructors(entry) {
  if (!Array.isArray(entry.constructors)) return;
  for (var i = 0; i < entry.constructors.length; i++) {
    createPropertiesFromConstructor(entry, entry.constructors[i]);
  }
}
function createPropertiesFromConstructor(classEntry, entry) {
  if (!Array.isArray(entry.parameters)) return;
  for (var i = 0; i < entry.parameters.length; i++) {
    const param = entry.parameters[i];
    if (!param.isPublic) continue;
    if (!classEntry.members) classEntry.members = [];
    classEntry.members.push(
      { name: param.name, pmeType: "property", isField: true, isPublic: true, type: param.type }
    );
  }
}
function getHeritageClause(node, index) {
  if (!node || !node.heritageClauses || node.heritageClauses.length <= index) return void 0;
  return node.heritageClauses[index];
}
function getFirstHeritageClauseType(node) {
  const clause = getHeritageClause(node, 0);
  return !!clause ? clause.types[0] : void 0;
}
function getImplementedTypes(ctx, node, className) {
  if (!node || !node.heritageClauses) return void 0;
  const clauses = node.heritageClauses;
  if (!Array.isArray(clauses) || clauses.length == 0) return void 0;
  const res = [];
  for (var i = 0; i < clauses.length; i++) {
    getImplementedTypesForClause(ctx, res, clauses[i], className);
  }
  return res;
}
function getImplementedTypesForClause(ctx, res, clause, className) {
  if (!clause || !Array.isArray(clause.types)) return void 0;
  for (var i = 0; i < clause.types.length; i++) {
    const name = getBaseType(ctx, clause.types[i]);
    if (!!name) {
      res.push(name);
    }
  }
}
function getBaseType(ctx, firstHeritageClauseType) {
  if (!firstHeritageClauseType) return "";
  const checker = ctx.checker;
  const expression = firstHeritageClauseType.expression;
  if (expression.kind === ts3.SyntaxKind.CallExpression && expression.arguments && expression.arguments.length > 0) {
    const arg = expression.arguments[0];
    const argType = checker.getTypeAtLocation(arg);
    if (argType && argType.symbol) {
      return argType.symbol.name;
    }
    if (arg.escapedText) return arg.escapedText;
    if (arg.text) return arg.text;
    return "";
  }
  const extendsType = checker.getTypeAtLocation(
    firstHeritageClauseType.expression
  );
  if (extendsType && extendsType.symbol) {
    const name = extendsType.symbol.name;
    if (!!expression.expression && expression.expression.escapedText)
      return expression.expression.escapedText + "." + name;
    return name;
  }
  if (!!expression.text) return expression.text;
  if (!!expression.expression && !!expression.expression.text && !!expression.name && !!expression.name.text)
    return expression.expression.text + "." + expression.name.text;
  return "";
}
function getTypedParameters(ctx, node, isArgument) {
  const params = getTypeParametersDeclaration(node, isArgument);
  if (!params || !Array.isArray(params)) return void 0;
  const res = [];
  for (var i = 0; i < params.length; i++) {
    const name = getTypeParameterName(ctx, params[i], isArgument);
    const extendsType = getTypeParameterConstrains(ctx, params[i]);
    res.push(name + extendsType);
  }
  return res.length > 0 ? res : void 0;
}
function getTypeParameterName(ctx, node, isArgument) {
  let symbol = ctx.checker.getSymbolAtLocation(isArgument ? node.typeName : node.name);
  if (!!symbol && symbol.name) return symbol.name;
  return "any";
}
function getTypeParameterConstrains(ctx, node) {
  if (!node.default) return "";
  const first = getTypeParameterName(ctx, node.default, true);
  const second = !!node.constraint ? getTypeParameterName(ctx, node.constraint, true) : "";
  if (!first) return "";
  if (!!second) return " extends " + first + " = " + second;
  return " = " + first;
}
function getTypeParametersDeclaration(node, isArgument) {
  if (!node) return void 0;
  if (!isArgument && !!node.typeParameters) return node.typeParameters;
  if (isArgument && !!node.typeArguments) return node.typeArguments;
  if (isArgument && !!node.elementType) return [node.elementType];
  return void 0;
}
function serializeMember(ctx, symbol, node) {
  const details = serializeSymbol(ctx, symbol);
  if (getPMEType(node.kind) !== "property") {
    setupMethodInfo(ctx, details, symbol, node);
  } else {
    details.isLocalizable = getIsPropertyLocalizable(ctx, node);
    if (details.isLocalizable) {
      details.hasSet = true;
    }
  }
  return details;
}
function setupMethodInfo(ctx, entry, symbol, node) {
  let signature = ctx.checker.getSignatureFromDeclaration(
    node
  );
  const funDetails = serializeSignature(ctx, signature);
  entry.parameters = funDetails.parameters;
  if (entry.parameters && entry.parameters.length > 0) {
    addNestedParameters(ctx, entry.parameters, node);
  }
  entry.returnType = funDetails.returnType;
  entry.typeGenerics = getTypedParameters(ctx, node, false);
  entry.returnTypeGenerics = getTypedParameters(ctx, node.type, true);
  if (entry.returnType === "Array" && !entry.returnTypeGenerics) {
    entry.returnTypeGenerics = ["any"];
  }
}
function getIsPropertyLocalizable(ctx, node) {
  if (!Array.isArray(node.decorators)) return false;
  const checker = ctx.checker;
  for (var i = 0; i < node.decorators.length; i++) {
    const decor = node.decorators[i];
    const expression = decor.expression["expression"];
    const decor_arguments = decor.expression["arguments"];
    if (!expression || !Array.isArray(decor_arguments)) continue;
    const sym = checker.getSymbolAtLocation(expression);
    if (!sym || sym.name !== "property") continue;
    for (var j = 0; j < decor_arguments.length; j++) {
      const arg = decor_arguments[j];
      const props = arg["properties"];
      if (!Array.isArray(props)) continue;
      for (var k = 0; k < props.length; k++) {
        const name = props[k]["name"];
        if (!name) continue;
        const symName = checker.getSymbolAtLocation(name);
        if (!!symName && symName.name === "localizable") return true;
      }
    }
  }
  return false;
}
function serializeSignature(ctx, signature) {
  const checker = ctx.checker;
  const params = signature.parameters;
  const res = {
    parameters: params.map((param) => serializeSymbol(ctx, param)),
    returnType: getReturnType(ctx, signature),
    documentation: ts3.displayPartsToString(
      signature.getDocumentationComment(void 0)
    )
  };
  for (var i = 0; i < params.length; i++) {
    const node = params[i].valueDeclaration;
    if (!!node) {
      res.parameters[i].isOptional = checker.isOptionalParameter(node);
    }
  }
  return res;
}
function addNestedParameters(ctx, parameters, node) {
  const checker = ctx.checker;
  if (node.jsDoc && node.jsDoc.length > 0) {
    const jsDoc = node.jsDoc[0];
    if (jsDoc.tags) {
      jsDoc.tags.forEach((tag) => {
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
function getReturnType(ctx, signature) {
  var res = ctx.checker.typeToString(signature.getReturnType());
  if (res === "{}") res = "any";
  if (res !== "any") return res;
  const type = signature.declaration.type;
  if (!type) return res;
  if (type.kind === ts3.SyntaxKind.ArrayType) return "Array";
  if (!type["typeName"]) return res;
  const name = type["typeName"].text;
  return !!name ? name : res;
}

// src/visitor.ts
function visit(ctx, node) {
  const checker = ctx.checker;
  if (!isNodeExported(node)) return;
  if (node.kind === ts4.SyntaxKind.VariableStatement) {
    const vsNode = node;
    if (vsNode.declarationList.declarations.length > 0) {
      const varNode = vsNode.declarationList.declarations[0];
      let symbol = checker.getSymbolAtLocation(
        varNode.name
      );
      if (!!symbol && isSymbolHasComments(symbol)) {
        visitVariableNode(ctx, varNode, symbol);
      }
    }
  } else if (node.kind === ts4.SyntaxKind.ClassDeclaration) {
    let symbol = checker.getSymbolAtLocation(
      node.name
    );
    if (!symbol) return;
    if (isSymbolHasComments(symbol)) {
      visitDocumentedNode(ctx, node, symbol);
    }
  } else if (node.kind === ts4.SyntaxKind.InterfaceDeclaration) {
    const name = node.name;
    let symbol = checker.getSymbolAtLocation(name);
    if (isSymbolHasComments(symbol) || isOptionsInterface(name.text)) {
      visitDocumentedNode(ctx, node, symbol);
    }
  } else if (node.kind === ts4.SyntaxKind.ModuleDeclaration) {
    ts4.forEachChild(node, (child) => visit(ctx, child));
  } else if (node.kind === ts4.SyntaxKind.TypeAliasDeclaration) {
    visitExportTypeAliasNode(ctx, node);
  }
}
function visitExportTypeAliasNode(ctx, node) {
  const checker = ctx.checker;
  const type = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(node.name));
  const types = type.types;
  if (Array.isArray(types) && types.length > 0) {
    const literals = [];
    for (let i = 0; i < types.length; i++) {
      if (typeof types[i].value === "string") {
        literals.push('"' + types[i].value + '"');
      }
    }
    if (types.length === literals.length) {
      stringLiteralTypes[node.name.text] = literals.join(" | ");
    }
  }
}
function visitVariableNode(ctx, node, symbol) {
  const entry = serializeSymbol(ctx, symbol);
  entry.entryType = 4 /* variableType */;
  visitVariableProperties(ctx, entry, node);
  entry.allTypes = [entry.name];
  entry.isPublic = true;
  ctx.outputClasses.push(entry);
  entry.members = [];
}
function visitVariableProperties(ctx, entry, node) {
  if (!node.initializer) return;
  const children = node.initializer.properties;
  if (!Array.isArray(children)) return;
  for (var i = 0; i < children.length; i++) {
    visitVariableMember(ctx, entry, children[i]);
  }
}
function visitVariableMember(ctx, entry, node) {
  let symbol = ctx.checker.getSymbolAtLocation(
    node.name
  );
  const memberEntry = serializeClass(ctx, symbol, node);
  if (memberEntry) {
    if (!entry.members) entry.members = [];
    entry.members.push(memberEntry);
    if (entry.entryType === 4 /* variableType */) {
      ctx.outputPMEs.push(memberEntry);
      memberEntry.className = entry.name;
      memberEntry.pmeType = "property";
      memberEntry.isPublic = true;
      memberEntry.isField = true, memberEntry.hasSet = true;
    }
    visitVariableProperties(ctx, memberEntry, node);
  }
}
function visitDocumentedNode(ctx, node, symbol) {
  ctx.curClass = serializeClass(ctx, symbol, node);
  ctx.classesHash[ctx.curClass.name] = ctx.curClass;
  let isOptions = ctx.curClass.name.indexOf("IOn") === 0;
  if (!isOptions) {
    ctx.outputClasses.push(ctx.curClass);
  }
  ctx.curJsonName = null;
  ts4.forEachChild(node, (child) => visitClassNode(ctx, child));
  if (isOptions) return;
  if (!ctx.curJsonName) return;
  ctx.curClass.jsonName = ctx.curJsonName;
  if (!jsonObjMetaData) return;
  const curJsonName = ctx.curJsonName;
  const curClass = ctx.curClass;
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
  for (let i = 0; i < ctx.outputPMEs.length; i++) {
    const pme = ctx.outputPMEs[i];
    if (pme.pmeType !== "property") continue;
    if (parentHiddenClasses.length > 0 && ctx.classesHash[pme.className]) {
      const pmeJsonName = pme.jsonName || ctx.classesHash[pme.className].jsonName;
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
function visitClassNode(ctx, node) {
  const checker = ctx.checker;
  var symbol = null;
  if (node.kind === ts4.SyntaxKind.MethodDeclaration)
    symbol = checker.getSymbolAtLocation(node.name);
  if (node.kind === ts4.SyntaxKind.FunctionDeclaration)
    symbol = checker.getSymbolAtLocation(node.name);
  if (node.kind === ts4.SyntaxKind.PropertyDeclaration)
    symbol = checker.getSymbolAtLocation(node.name);
  if (node.kind === ts4.SyntaxKind.GetAccessor)
    symbol = checker.getSymbolAtLocation(
      node.name
    );
  if (node.kind === ts4.SyntaxKind.SetAccessor)
    symbol = checker.getSymbolAtLocation(
      node.name
    );
  if (node.kind === ts4.SyntaxKind.PropertySignature)
    symbol = checker.getSymbolAtLocation(node.name);
  if (node.kind === ts4.SyntaxKind.MethodSignature)
    symbol = checker.getSymbolAtLocation(node.name);
  if (!symbol) return;
  if (!isPMENodeExported(node, symbol)) return;
  var ser = serializeMember(ctx, symbol, node);
  let fullName = ser.name;
  if (ctx.curClass) {
    ser.className = ctx.curClass.name;
    ser.jsonName = ctx.curClass.jsonName;
    fullName = ctx.curClass.name + "." + fullName;
    if (!ctx.curClass.members) ctx.curClass.members = [];
    if (!hasMembers(ctx.curClass, ser.name)) {
      ctx.curClass.members.push(ser);
    }
  }
  ser.pmeType = getPMEType(node.kind);
  const modifier = ts4.getCombinedModifierFlags(node);
  if ((modifier & ts4.ModifierFlags.Static) !== 0) {
    ser.isStatic = true;
  }
  if ((modifier & ts4.ModifierFlags.Protected) !== 0) {
    ser.isProtected = true;
  }
  if (node.kind === ts4.SyntaxKind.PropertyDeclaration && !ser.isLocalizable && ser.isField === void 0) {
    ser.isField = true;
  }
  if (node.kind === ts4.SyntaxKind.PropertySignature) {
    ser.isField = true;
    ser.isOptional = checker.isOptionalParameter(node);
  }
  if (isSurveyEventType(ser.type)) {
    ser.pmeType = "event";
    updateEventOptionInterfaceName(ctx, node, ser);
    if (!ser.documentation) {
      ser = null;
    }
  }
  if (ser && node.kind === ts4.SyntaxKind.GetAccessor) {
    ser.isField = false;
    let serSet = ctx.pmesHash[fullName];
    if (serSet) {
      ser.hasSet = serSet.hasSet;
    } else ser.hasSet = false;
  }
  if (node.kind === ts4.SyntaxKind.SetAccessor) {
    let serGet = ctx.pmesHash[fullName];
    if (serGet) {
      serGet.hasSet = true;
      ser.isField = false;
    }
    ser = null;
  }
  if (ser) {
    if (!ser.parameters) ser.parameters = [];
    ctx.pmesHash[fullName] = ser;
    ctx.outputPMEs.push(ser);
  }
  if (ser && ser.name === "getType") {
    ctx.curJsonName = getJsonTypeName(node);
  }
}

// src/constants.ts
var EventDescriptReplacedText = "For information on event handler parameters, refer to descriptions within the interface.";
var SurveyModelSenderDescription = "A survey instance that raised the event.";
var CreatorModelSenderDescription = "A Survey Creator instance that raised the event.";

// src/event-docs.ts
function updateEventsDocumentation(ctx) {
  for (let i = 0; i < ctx.outputPMEs.length; i++) {
    const ser = ctx.outputPMEs[i];
    if (!ser.eventSenderName || !ser.eventOptionsName || ser.eventOptionsName === "__type") continue;
    if (!ser.documentation) ser.documentation = "";
    if (ser.documentation.indexOf("- `sender`:") > -1) continue;
    const lines = [];
    lines.push("");
    lines.push("Parameters:");
    lines.push("");
    updateEventDocumentationSender(ser, lines);
    updateEventDocumentationOptions(ctx, ser, lines);
    let replacedTextIndex = ser.documentation.indexOf(EventDescriptReplacedText);
    if (replacedTextIndex > -1) {
      ser.documentation = ser.documentation.replace(EventDescriptReplacedText, lines.join("\n"));
    } else {
      lines.unshift("");
      ser.documentation += lines.join("\n");
    }
  }
}
function updateHiddenForEntriesDoc(ctx) {
  const addedEntries = [];
  for (let i = 0; i < ctx.outputPMEs.length; i++) {
    const ser = ctx.outputPMEs[i];
    if (Array.isArray(ser.hideForClasses)) {
      ser.hideForClasses.forEach((className) => {
        hideEntryForClass(ctx, ser, className, addedEntries);
      });
    }
    if (ser.isHidden === true && !!ser.className) {
      ctx.outputClasses.forEach((cls) => {
        if (cls.name !== ser.className && Array.isArray(cls.allTypes) && cls.allTypes.indexOf(ser.className) > -1) {
          hideEntryForClass(ctx, ser, cls.name, addedEntries);
        }
      });
    }
  }
  addedEntries.forEach((entry) => {
    ctx.outputPMEs.push(entry);
  });
}
function hideEntryForClass(ctx, ser, className, addedEntries) {
  const classEntry = ctx.classesHash[className];
  if (!classEntry) return;
  if (!Array.isArray(classEntry.members)) {
    classEntry.members = [];
  }
  let entry = classEntry.members.find((item) => item.name === ser.name);
  if (!entry) {
    entry = JSON.parse(JSON.stringify(ser));
    classEntry.members.push(entry);
    addedEntries.push(entry);
  }
  entry.className = className;
  entry.isHidden = true;
  entry.documentation = "";
}
function updateEventDocumentationSender(ser, lines) {
  if (!ser.eventSenderName) return;
  let desc = "";
  if (ser.eventSenderName === "SurveyModel") {
    desc = SurveyModelSenderDescription;
  }
  if (ser.eventSenderName.indexOf("Creator") > -1) {
    desc = CreatorModelSenderDescription;
  }
  lines.push(" - `sender`: `" + ser.eventSenderName + "`" + (!!desc ? "  " : ""));
  if (!!desc) {
    lines.push(desc);
  }
}
function updateEventDocumentationOptions(ctx, ser, lines) {
  if (!ser.eventOptionsName) return;
  const members = {};
  fillEventMembers(ctx, ser.eventOptionsName, members);
  for (let key in members) {
    const m = members[key];
    let doc = m.documentation;
    if (m.isHidden === true || isHiddenEntryByDoc(doc)) continue;
    lines.push("- `options." + m.name + "`: `" + m.type + "`" + (!!doc ? "  " : ""));
    if (!!doc) {
      lines.push(doc);
    }
  }
  ;
}
function isHiddenEntryByDoc(doc) {
  if (!doc) return true;
  doc = doc.toLocaleLowerCase();
  return doc.startsWith("obsolete") || doc.startsWith("for internal use");
}
function fillEventMembers(ctx, interfaceName, members) {
  const classEntry = ctx.classesHash[interfaceName];
  if (!classEntry) return;
  if (Array.isArray(classEntry.implements)) {
    for (let i = 0; i < classEntry.implements.length; i++) {
      fillEventMembers(ctx, classEntry.implements[i], members);
    }
  }
  if (!Array.isArray(classEntry.members)) return;
  for (let i = 0; i < classEntry.members.length; i++) {
    const m = classEntry.members[i];
    members[m.name] = m;
  }
}

// src/json-definition.ts
function addClassIntoJSONDefinition(ctx, className, isRoot = false) {
  if (className == "IElement") {
    className = "SurveyElement";
  }
  if (!!ctx.generateJSONDefinitionClasses[className]) return;
  ctx.generateJSONDefinitionClasses[className] = true;
  var cur = ctx.classesHash[className];
  if (!isRoot && (!cur || !hasSerializedProperties(ctx, className))) {
    addChildrenClasses(ctx, className);
    return;
  }
  if (!cur || !isRoot && hasClassInJSONDefinition(ctx, className)) return;
  var root = ctx.outputDefinition;
  if (!isRoot) {
    if (!ctx.outputDefinition["definitions"]) {
      ctx.outputDefinition["definitions"] = {};
    }
    ctx.outputDefinition["definitions"][cur.jsonName] = {};
    root = ctx.outputDefinition["definitions"][cur.jsonName];
    root["$id"] = "#" + cur.jsonName;
  }
  root["type"] = "object";
  addPropertiesIntoJSONDefinion(ctx, cur, root);
  if (!isRoot) {
    addParentClass(ctx, cur, root);
    addChildrenClasses(ctx, cur.name);
  }
}
function addParentClass(ctx, cur, root) {
  if (!cur.baseType) return;
  addClassIntoJSONDefinition(ctx, cur.baseType);
  var parentClass = ctx.classesHash[cur.baseType];
  if (!!parentClass && hasClassInJSONDefinition(ctx, parentClass.jsonName)) {
    var properties = root["properties"];
    delete root["properties"];
    root["allOff"] = [
      { $ref: "#" + parentClass.jsonName },
      { properties }
    ];
  }
}
function addChildrenClasses(ctx, className) {
  for (var i = 0; i < ctx.outputClasses.length; i++) {
    if (ctx.outputClasses[i].baseType == className) {
      addClassIntoJSONDefinition(ctx, ctx.outputClasses[i].name);
    }
  }
}
function hasClassInJSONDefinition(ctx, className) {
  return !!ctx.outputDefinition["definitions"] && !!ctx.outputDefinition["definitions"][className];
}
function addPropertiesIntoJSONDefinion(ctx, cur, jsonDef) {
  for (var i = 0; i < ctx.outputPMEs.length; i++) {
    var property = ctx.outputPMEs[i];
    if (property.className !== cur.name || !property.isSerialized)
      continue;
    addPropertyIntoJSONDefinion(ctx, property, jsonDef);
  }
}
function hasSerializedProperties(ctx, className) {
  for (var i = 0; i < ctx.outputPMEs.length; i++) {
    var property = ctx.outputPMEs[i];
    if (property.className == className && property.isSerialized) return true;
  }
  return false;
}
function addPropertyIntoJSONDefinion(ctx, property, jsonDef) {
  if (!jsonDef.properties) {
    jsonDef.properties = {};
  }
  var properties = jsonDef.properties;
  var typeName = property.type;
  var isArray = !!typeName && typeName.indexOf("[]") > -1;
  if (!!property.jsonClassName || isArray) {
    addClassIntoJSONDefinition(ctx, typeName.replace("[]", ""));
  }
  var typeInfo = getTypeValue(ctx, property);
  var propInfo = { type: typeInfo };
  if (isArray) {
    propInfo = { type: "array", items: typeInfo };
  }
  if (!!property.serializedChoices && Array.isArray(property.serializedChoices) && property.serializedChoices.length > 1) {
    propInfo["enum"] = property.serializedChoices;
  }
  properties[property.name] = propInfo;
}
function getTypeValue(ctx, property) {
  var propType = property.type;
  if (propType.indexOf("|") > 0) return ["boolean", "string"];
  if (propType == "any") return ["string", "numeric", "boolean"];
  if (propType == "string" || propType == "numeric" || propType == "boolean")
    return propType;
  var childrenTypes = [];
  addChildrenTypes(ctx, propType.replace("[]", ""), childrenTypes);
  if (childrenTypes.length == 1) return getReferenceType(ctx, childrenTypes[0]);
  if (childrenTypes.length > 1) {
    var res = [];
    for (var i = 0; i < childrenTypes.length; i++) {
      res.push(getReferenceType(ctx, childrenTypes[i]));
    }
    return res;
  }
  return getReferenceType(ctx, propType.replace("[]", ""));
}
function addChildrenTypes(ctx, type, childrenTypes) {
  if (type == "IElement") type = "SurveyElement";
  for (var i = 0; i < ctx.outputClasses.length; i++) {
    if (ctx.outputClasses[i].baseType == type) {
      var count = childrenTypes.length;
      addChildrenTypes(ctx, ctx.outputClasses[i].name, childrenTypes);
      if (count == childrenTypes.length) {
        childrenTypes.push(ctx.outputClasses[i].name);
      }
    }
  }
}
function getReferenceType(ctx, type) {
  var curClass = ctx.classesHash[type];
  if (!curClass) return type;
  return { $href: "#" + curClass.jsonName };
}

// src/md-generator.ts
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var productRules = [
  { product: "PDF Generator", keywords: ["pdf"] },
  { product: "Survey Creator", keywords: ["creator"] },
  { product: "Dashboard", keywords: ["dashboard", "analytics"] }
];
function detectProduct(fileNames, cwd) {
  const parts = [];
  if (Array.isArray(fileNames)) parts.push(...fileNames);
  if (cwd) parts.push(cwd);
  const haystack = parts.join(" ").replace(/\\/g, "/").toLowerCase();
  for (let i = 0; i < productRules.length; i++) {
    const rule = productRules[i];
    if (rule.keywords.some((k) => haystack.indexOf(k) > -1)) return rule.product;
  }
  return "Form Library";
}
var libraryNames = {
  "Form Library": "form-library",
  "Survey Creator": "survey-creator",
  "Dashboard": "dashboard",
  "PDF Generator": "pdf-generator"
};
function sourceUrl(product, className, baseUrl) {
  const base = (baseUrl || "https://surveyjs.io").replace(/\/+$/, "");
  const library = libraryNames[product] || libraryNames["Form Library"];
  return base + "/" + library + "/documentation/api-reference/" + (className || "").toLowerCase();
}
function generateMDFiles(classes, pmes, options = {}) {
  if (!Array.isArray(classes)) return;
  const members = Array.isArray(pmes) ? pmes : [];
  const outputDir = options.outputDir || path3.join(process.cwd(), "docs", "api");
  ensureDir(outputDir);
  const product = options.product || detectProduct(options.fileNames, process.cwd());
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];
    if (!isClassOrInterface(cls) || !cls.name || !hasDescription(cls)) continue;
    const content = generateMDForClass(cls, members, product, options.sourceBaseUrl);
    fs3.writeFileSync(path3.join(outputDir, cls.name + ".md"), content);
  }
  fs3.writeFileSync(path3.join(outputDir, "index.md"), generateIndexMD(classes, members));
}
function generateIndexMD(classes, pmes) {
  const members = Array.isArray(pmes) ? pmes : [];
  const entries = (Array.isArray(classes) ? classes : []).filter((cls) => !!cls && cls.entryType === 1 /* classType */ && !!cls.name && hasDescription(cls)).map((cls) => ({
    name: cls.name,
    sentence: firstSentence(stripMarkdownLinks(cls.documentation)),
    count: members.filter((p) => p.className === cls.name && isVisibleMember(p)).length
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const lines = ["---", "title: Classes", "---", "", "# Classes", ""];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    lines.push("- `" + entry.name + "`" + (entry.sentence ? " \u2014 " + entry.sentence : ""));
  }
  return lines.join("\n") + "\n";
}
function hasDescription(cls) {
  return !!cls && !!(cls.documentation || "").trim();
}
function stripMarkdownLinks(text) {
  if (!text) return "";
  return String(text).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}
function firstSentence(text) {
  const line = oneLine(text);
  if (!line) return "";
  const match = line.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : line;
}
function ensureDir(dir) {
  if (!fs3.existsSync(dir)) {
    fs3.mkdirSync(dir, { recursive: true });
  }
}
function isClassOrInterface(cls) {
  return !!cls && (cls.entryType === 1 /* classType */ || cls.entryType === 2 /* interfaceType */);
}
function generateMDForClass(cls, pmes, product, sourceBaseUrl) {
  const isInterface = cls.entryType === 2 /* interfaceType */;
  const members = pmes.filter((p) => p.className === cls.name && isVisibleMember(p)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const properties = members.filter((p) => p.pmeType === "property");
  const methods = members.filter((p) => p.pmeType === "method");
  const events = members.filter((p) => p.pmeType === "event");
  const parts = [];
  parts.push(frontMatter(cls, product, isInterface, sourceBaseUrl));
  parts.push("# `" + cls.name + "`");
  const description = (cls.documentation || "").trim();
  if (description) parts.push(description);
  const inheritance = inheritanceSection(cls);
  if (inheritance) parts.push(inheritance);
  if (properties.length > 0) parts.push(propertiesSection(properties));
  if (methods.length > 0) parts.push(methodsSection(methods));
  if (events.length > 0) parts.push(eventsSection(events));
  return parts.join("\n\n") + "\n";
}
function isVisibleMember(member) {
  return member.isHidden !== true && member.isProtected !== true && hasDescription(member);
}
function frontMatter(cls, product, isInterface, sourceBaseUrl) {
  const title = cls.metaTitle || cls.name || "";
  const description = firstSentence(stripMarkdownLinks(cls.metaDescription || cls.documentation));
  const source = sourceUrl(product, cls.name, sourceBaseUrl);
  const lines = [
    "---",
    "title: " + yamlScalar(title),
    "product: " + yamlScalar(product),
    "api-type: " + (isInterface ? "interface" : "class"),
    "description: " + yamlScalar(description),
    "source: " + yamlScalar(source),
    "---"
  ];
  return lines.join("\n");
}
function inheritanceSection(cls) {
  const all = Array.isArray(cls.allTypes) && cls.allTypes.length > 0 ? cls.allTypes : [cls.name];
  if (all.length <= 1) return "";
  const chain = all.slice().reverse().map((t) => "`" + t + "`").join(" &rarr; ");
  return "## Inheritance\n\n" + chain;
}
function propertiesSection(properties) {
  const blocks = properties.map((prop) => {
    const lines = ["### `" + prop.name + "`"];
    const doc = (prop.documentation || "").trim();
    if (doc) lines.push(doc);
    lines.push("**Type**: `" + typeString(prop.type, prop.returnTypeGenerics) + "`");
    return lines.join("\n\n");
  });
  return "## Properties\n\n" + blocks.join("\n\n");
}
function methodsSection(methods) {
  const blocks = methods.map((method) => {
    const lines = ["### `" + method.name + "()`"];
    const doc = (method.documentation || "").trim();
    if (doc) lines.push(doc);
    const returnValue = returnValueLine(method);
    if (returnValue) lines.push(returnValue);
    const table = parametersTable(method.parameters);
    if (table) lines.push("**Parameters:**\n\n" + table);
    return lines.join("\n\n");
  });
  return "## Methods\n\n" + blocks.join("\n\n");
}
function eventsSection(events) {
  const blocks = events.map((event) => {
    const lines = ["### `" + event.name + "`"];
    const doc = (event.documentation || "").trim();
    if (doc) lines.push(doc);
    return lines.join("\n\n");
  });
  return "## Events\n\n" + blocks.join("\n\n");
}
function returnValueLine(method) {
  const type = typeString(method.returnType, method.returnTypeGenerics);
  if (!type || type === "void") return "";
  const returnDoc = oneLine(method.returnDocumentation);
  let line = "**Return value:** `" + type + "`";
  if (returnDoc) line += " &ndash; " + returnDoc;
  return line;
}
function parametersTable(parameters) {
  if (!Array.isArray(parameters) || parameters.length === 0) return "";
  const rows = [
    "| Name | Type | Description |",
    "| ---- | ---- | ----------- |"
  ];
  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    rows.push(
      "| `" + tableCell(param.name) + "` | `" + tableCell(param.type) + "` | " + tableCell(param.documentation) + " |"
    );
  }
  return rows.join("\n");
}
function typeString(type, generics) {
  const base = type || "any";
  if (Array.isArray(generics) && generics.length > 0) {
    return base + "<" + generics.join(", ") + ">";
  }
  return base;
}
function oneLine(text) {
  if (!text) return "";
  return String(text).replace(/\s+/g, " ").trim();
}
function tableCell(text) {
  return oneLine(text).replace(/\|/g, "\\|");
}
function yamlScalar(value) {
  const text = oneLine(value);
  if (text === "") return "";
  const needsQuoting = /:(\s|$)/.test(text) || /\s#/.test(text) || /["\\]/.test(text) || /^[-?:,\[\]{}#&*!|>'"%@`]/.test(text);
  if (needsQuoting) {
    return '"' + text.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  return text;
}

// src/generator.ts
function generateDocumentation(fileNames, options, docOptions = {}) {
  const ctx = {
    checker: null,
    outputClasses: [],
    outputPMEs: [],
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
  const tsOptions = getTsOptions(options);
  if (!checkFiles(fileNames, "File for compiling is not found")) return;
  const host = ts5.createCompilerHost(tsOptions);
  const program = ts5.createProgram(fileNames, tsOptions, host);
  ctx.checker = program.getTypeChecker();
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName.indexOf("node_modules") > 0) continue;
    if (isNonEnglishLocalizationFile(sourceFile.fileName)) continue;
    ts5.forEachChild(sourceFile, (node) => visit(ctx, node));
  }
  for (var i = 0; i < fileNames.length; i++) {
    const sourceFile = program.getSourceFile(fileNames[i]);
    if (!!sourceFile) {
      ts5.forEachChild(sourceFile, (node) => visit(ctx, node));
    }
  }
  for (var key in ctx.classesHash) {
    setAllParentTypes(ctx, key);
  }
  updateEventsDocumentation(ctx);
  updateHiddenForEntriesDoc(ctx);
  if (docOptions.generateMDFiles === true) {
    const mdOptions = Object.assign({ fileNames }, docOptions.mdOptions);
    generateMDFiles(ctx.outputClasses, ctx.outputPMEs, mdOptions);
  } else {
    fs4.writeFileSync(
      process.cwd() + "/docs/classes.json",
      JSON.stringify(ctx.outputClasses, void 0, 4)
    );
    fs4.writeFileSync(
      process.cwd() + "/docs/pmes.json",
      JSON.stringify(ctx.outputPMEs, void 0, 4)
    );
  }
  if (ctx.generateJSONDefinition) {
    ctx.outputDefinition["$schema"] = "http://json-schema.org/draft-07/schema#";
    ctx.outputDefinition["title"] = "SurveyJS Library json schema";
    addClassIntoJSONDefinition(ctx, "SurveyModel", true);
    fs4.writeFileSync(
      process.cwd() + "/docs/surveyjs_definition.json",
      JSON.stringify(ctx.outputDefinition, void 0, 4)
    );
  }
  deleteVueTSFiles(ctx);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateDocumentation,
  generateMDFiles,
  setJsonObj
});
