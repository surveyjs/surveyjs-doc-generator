"use strict";
exports.__esModule = true;
exports.generateDocumentation = exports.generateDts = exports.setJsonObj = void 0;
var ts = require("typescript");
var fs = require("fs");
var path = require("path");
var EventDescriptReplacedText = "For information on event handler parameters, refer to descriptions within the interface.";
var SurveyModelSenderDescription = "A survey instance that raised the event.";
var CreatorModelSenderDescription = "A Survey Creator instance that raised the event.";
var DocEntryType;
(function (DocEntryType) {
    DocEntryType[DocEntryType["unknown"] = 0] = "unknown";
    DocEntryType[DocEntryType["classType"] = 1] = "classType";
    DocEntryType[DocEntryType["interfaceType"] = 2] = "interfaceType";
    DocEntryType[DocEntryType["functionType"] = 3] = "functionType";
    DocEntryType[DocEntryType["variableType"] = 4] = "variableType";
    DocEntryType[DocEntryType["enumType"] = 5] = "enumType";
})(DocEntryType || (DocEntryType = {}));
;
var callbackFuncResultStr = ") => ";
var isExportingReact = false;
var jsonObjMetaData = null;
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
//"lib": [ "es2015", "es2017", "es6", "dom", "es2015.iterable" ],
function getTsOptions(options) {
    var res = {};
    for (key in tsDefaultOptions)
        res[key] = tsDefaultOptions[key];
    for (var key in options)
        res[key] = options[key];
    return res;
}
function setJsonObj(obj) {
    jsonObjMetaData = obj;
}
exports.setJsonObj = setJsonObj;
function printError(text) {
    console.log(text);
}
function checkFiles(fileNames, errorText) {
    if (!Array.isArray(fileNames)) {
        printError("file list is empty");
        return false;
    }
    for (var i = 0; i < fileNames.length; i++) {
        var absFileName = getAbsoluteFileName(fileNames[i]);
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
function generateDts(options) {
    if (!options.out) {
        printError("out is empty.");
        return;
    }
    var outDir = path.dirname(options.out);
    if (!checkFiles([outDir], "directory for out file is not found"))
        return;
    var docOptions = {
        generateDoc: false,
        generateJSONDefinition: false,
        dtsOutput: options.out,
        dtsExcludeImports: options.excludeImports === true,
        paths: options.paths,
        name: options.name,
        license: options.license
    };
    var tsOptions = {};
    if (options.paths) {
        tsOptions.paths = options.paths;
        tsOptions.baseUrl = process.cwd();
    }
    generateDocumentation(options.entries, tsOptions, docOptions);
    if (!checkFiles([options.out], "Generated d.ts file is not found"))
        return;
    var program = ts.createProgram([options.out], getTsOptions(tsOptions));
    var srcFile = program.getSourceFile(options.out);
    var diagnostics = program.getSyntacticDiagnostics(srcFile);
    for (var i = 0; i < diagnostics.length; i++) {
        var msgText = diagnostics[i].messageText;
        var errorText = "Error: " + (!!msgText.messageText ? msgText.messageText : msgText);
        if (!!diagnostics[i].source) {
            errorText += " . Source: " + diagnostics[i].source;
        }
        printError(errorText);
    }
}
exports.generateDts = generateDts;
/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(fileNames, options, docOptions) {
    if (docOptions === void 0) { docOptions = {}; }
    var dtsVueGeneratedFiles = [];
    generateVueTSFiles(fileNames);
    var tsOptions = getTsOptions(options);
    if (!checkFiles(fileNames, "File for compiling is not found"))
        return;
    var host = ts.createCompilerHost(tsOptions);
    // Build a program using the set of root file names in fileNames
    var program = ts.createProgram(fileNames, tsOptions, host);
    // Get the checker, we will use it to find more about classes
    var checker = program.getTypeChecker();
    var outputClasses = [];
    var outputPMEs = [];
    var pmesHash = {};
    var classesHash = {};
    var curClass = null;
    var curJsonName = null;
    var generateJSONDefinitionClasses = {};
    var dtsOutput = !!docOptions ? docOptions.dtsOutput : undefined;
    var generateDts = !!dtsOutput;
    var generateJSONDefinition = docOptions.generateJSONDefinition === true;
    var generateDocs = !generateDts || docOptions.generateDoc !== false;
    var outputDefinition = {};
    var dtsExportedClasses = {};
    var dtsExportClassesFromLibraries = [];
    var dtsImports = {};
    var dtsExcludeImports = docOptions.dtsExcludeImports === true;
    var dtsExportNames = [];
    if (!!docOptions.paths) {
        for (key in docOptions.paths)
            dtsExportNames.push(key);
    }
    var dtsImportDeclarations = {};
    var dtsFrameworksImportDeclarations = {};
    var dtsDeclarations = {};
    var dtsTypesParameters = {};
    var dtsTypesArgumentParameters = {};
    var dtsProductName = docOptions.name;
    var dtsLicense = docOptions.license;
    var dtsVersion = "";
    // Visit every sourceFile in the program
    for (var _i = 0, _a = program.getSourceFiles(); _i < _a.length; _i++) {
        var sourceFile = _a[_i];
        if (sourceFile.fileName.indexOf("node_modules") > 0)
            continue;
        if (isNonEnglishLocalizationFile(sourceFile.fileName))
            continue;
        // Walk the tree to search for classes
        ts.forEachChild(sourceFile, visit);
    }
    for (var i = 0; i < fileNames.length; i++) {
        var sourceFile = program.getSourceFile(fileNames[i]);
        if (!!sourceFile) {
            ts.forEachChild(sourceFile, visit);
        }
    }
    for (var key in classesHash) {
        setAllParentTypes(key);
    }
    if (generateDocs) {
        updateEventsDocumentation();
        // print out the doc
        fs.writeFileSync(process.cwd() + "/docs/classes.json", JSON.stringify(outputClasses, undefined, 4));
        fs.writeFileSync(process.cwd() + "/docs/pmes.json", JSON.stringify(outputPMEs, undefined, 4));
    }
    if (generateJSONDefinition) {
        outputDefinition["$schema"] = "http://json-schema.org/draft-07/schema#";
        outputDefinition["title"] = "SurveyJS Library json schema";
        addClassIntoJSONDefinition("SurveyModel", true);
        fs.writeFileSync(process.cwd() + "/docs/surveyjs_definition.json", JSON.stringify(outputDefinition, undefined, 4));
    }
    if (generateDts) {
        prepareDtsInfo();
        dtsImportFiles(docOptions.paths);
        var text = "";
        if (!!dtsProductName) {
            dtsVersion = dtsGetVersion();
            text += dtsGetBanner();
        }
        text += dtsGetText();
        fs.writeFileSync(getAbsoluteFileName(dtsOutput), text);
    }
    deleteVueTSFiles();
    return;
    function generateVueTSFiles(fileNames) {
        for (var i = 0; i < fileNames.length; i++) {
            var fn = fileNames[i];
            var text = fs.readFileSync(getAbsoluteFileName(fn), 'utf8');
            var dir = path.dirname(fn);
            generateVueTSFile(text, dir);
            var matchArray = text.match(/(?<=export \* from ")(.*)(?=";)/gm);
            if (!Array.isArray(matchArray))
                continue;
            for (var i = 0; i < matchArray.length; i++) {
                var fnChild = path.join(dir, matchArray[i] + ".ts");
                var absFnChild = getAbsoluteFileName(fnChild);
                if (!fs.existsSync(absFnChild))
                    return;
                text = fs.readFileSync(absFnChild, 'utf8');
                generateVueTSFile(text, dir);
            }
        }
    }
    function generateVueTSFile(text, dir) {
        var matchArray = text.match(/(?<=")(.*)(?=.vue";)/gm);
        if (!Array.isArray(matchArray))
            return;
        for (var i = 0; i < matchArray.length; i++) {
            var fileName = path.join(dir, matchArray[i] + ".vue");
            if (!fs.existsSync(fileName))
                continue;
            var absFileName = getAbsoluteFileName(fileName);
            var vueText = fs.readFileSync(absFileName, 'utf8');
            var startStr = "<script lang=\"ts\">";
            var endStr = "</script>";
            var startIndex = vueText.indexOf(startStr) + startStr.length;
            var endIndex = vueText.lastIndexOf(endStr);
            if (endIndex > startIndex && startIndex > 0) {
                var vue_tsText = vueText.substring(startIndex, endIndex);
                absFileName += ".ts";
                dtsVueGeneratedFiles.push(absFileName);
                fs.writeFileSync(absFileName, vue_tsText);
            }
        }
    }
    function deleteVueTSFiles() {
        for (var i = 0; i < dtsVueGeneratedFiles.length; i++) {
            fs.unlinkSync(dtsVueGeneratedFiles[i]);
        }
    }
    function isNonEnglishLocalizationFile(fileName) {
        var dir = path.dirname(fileName);
        var name = path.basename(fileName);
        if (name === "english")
            return false;
        var loc = "localization";
        return dir.lastIndexOf(loc) > dir.length - loc.length - 3;
    }
    function dtsGetVersion() {
        var fileName = getAbsoluteFileName("package.json");
        if (!fs.existsSync(fileName))
            return "";
        var text = fs.readFileSync(fileName, 'utf8');
        if (!text)
            return "";
        var matches = text.match(/(?<="version":)(.*)(?=,)/gm);
        if (!Array.isArray(matches) || matches.length === 0)
            return "";
        var res = matches[0];
        if (!res)
            return "";
        return res.trim().replace("\"", "").replace("\"", "");
    }
    function dtsGetBanner() {
        var lines = [];
        lines.push("/*");
        var paddging = "* ";
        lines.push(paddging + dtsProductName + (dtsVersion ? " v" + dtsVersion : ""));
        lines.push(paddging + "Copyright (c) 2015-" + new Date().getFullYear() + " Devsoft Baltic OÜ  - https://surveyjs.io/");
        if (dtsLicense) {
            lines.push(paddging + "License: " + dtsLicense);
        }
        lines.push("*/");
        lines.push("");
        return lines.join("\n");
    }
    /** set allParentTypes */
    function setAllParentTypes(className) {
        if (!className)
            return;
        var cur = classesHash[className];
        if (cur.allTypes && cur.allTypes.length > 0)
            return;
        setAllParentTypesCore(cur);
    }
    function setAllParentTypesCore(cur) {
        cur.allTypes = [];
        cur.allTypes.push(cur.name);
        if (cur.entryType === DocEntryType.interfaceType && Array.isArray(cur.implements)) {
            cur.implements.forEach(function (item) { return addBaseAllTypesIntoCur(cur, item); });
        }
        if (!cur.baseType)
            return;
        addBaseAllTypesIntoCur(cur, cur.baseType);
    }
    function addBaseAllTypesIntoCur(cur, className) {
        if (!className)
            return;
        var baseClass = classesHash[className];
        if (!baseClass)
            return;
        if (!baseClass.allTypes) {
            setAllParentTypesCore(baseClass);
        }
        for (var i = 0; i < baseClass.allTypes.length; i++) {
            cur.allTypes.push(baseClass.allTypes[i]);
        }
    }
    /** visit nodes finding exported classes */
    function visit(node) {
        // Only consider exported nodes
        if (!isNodeExported(node))
            return;
        if (node.kind === ts.SyntaxKind.EnumDeclaration) {
            var enNode = node;
            var symbol = checker.getSymbolAtLocation(enNode.name);
            if (!!symbol && generateDts) {
                visitEnumNode(enNode, symbol);
            }
        }
        else if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
            var fnNode = node;
            var symbol = checker.getSymbolAtLocation(fnNode.name);
            if (!!symbol && generateDts) {
                visitFunctionNode(fnNode, symbol);
            }
        }
        else if (node.kind === ts.SyntaxKind.VariableStatement) {
            var vsNode = node;
            if (vsNode.declarationList.declarations.length > 0) {
                var varNode = vsNode.declarationList.declarations[0];
                var symbol = checker.getSymbolAtLocation(varNode.name);
                if (!!symbol && (generateDts || isSymbolHasComments(symbol))) {
                    visitVariableNode(varNode, symbol);
                }
            }
        }
        else if (node.kind === ts.SyntaxKind.ClassDeclaration) {
            // This is a top level class, get its symbol
            var symbol = checker.getSymbolAtLocation(node.name);
            if (!symbol)
                return;
            if (generateDts || isSymbolHasComments(symbol)) {
                visitDocumentedNode(node, symbol);
            }
        }
        else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            // This is a top level class, get its symbol
            var name_1 = node.name;
            var symbol = checker.getSymbolAtLocation(name_1);
            if (generateDts || isSymbolHasComments(symbol) || isOptionsInterface(name_1.text)) {
                visitDocumentedNode(node, symbol);
            }
        }
        else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
            // This is a namespace, visit its children
            ts.forEachChild(node, visit);
        }
        else if (node.kind === ts.SyntaxKind.ExportDeclaration) {
            visitExportDeclarationNode(node);
        }
    }
    function visitExportDeclarationNode(node) {
        if (!node.exportClause)
            return;
        if (isExportFromDtsFile(node))
            return;
        var els = node.exportClause.elements;
        if (!Array.isArray(els))
            return;
        var exportLibrary = getExportLibraryName(node);
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (!el.name || !el.propertyName && !exportLibrary)
                continue;
            var name_2 = el.name.text;
            if (!name_2)
                continue;
            if (!exportLibrary && dtsImportDeclarations[name_2])
                continue;
            var entry = { name: name_2 };
            if (!!el.propertyName) {
                entry.className = el.propertyName.text;
            }
            if (!!exportLibrary) {
                entry.fileName = exportLibrary;
            }
            dtsExportClassesFromLibraries.push(entry);
        }
    }
    function isExportFromDtsFile(node) {
        if (!node.parent)
            return false;
        var file = node.parent.getSourceFile();
        if (!file)
            return false;
        return file.fileName.indexOf(".d.ts") > -1;
    }
    function getExportLibraryName(node) {
        var name = !!node.moduleSpecifier ? node.moduleSpecifier.text : undefined;
        if (!name)
            return undefined;
        return dtsExportNames.indexOf(name) > -1 ? name : undefined;
    }
    function visitVariableNode(node, symbol) {
        var entry = serializeSymbol(symbol);
        entry.entryType = DocEntryType.variableType;
        dtsDeclarations[entry.name] = entry;
        visitVariableProperties(entry, node);
        if (generateDocs) {
            entry.allTypes = [entry.name];
            entry.isPublic = true;
            outputClasses.push(entry);
            entry.members = [];
        }
    }
    function visitEnumNode(node, symbol) {
        var modifier = ts.getCombinedModifierFlags(node);
        if ((modifier & ts.ModifierFlags.Export) === 0)
            return;
        var entry = {
            name: symbol.name,
            entryType: DocEntryType.enumType,
            members: []
        };
        dtsDeclarations[entry.name] = entry;
        for (var i = 0; i < node.members.length; i++) {
            var member = node.members[i];
            var sym = checker.getSymbolAtLocation(member.name);
            if (!!sym && !!sym.name) {
                var id = !!member.initializer ? member.initializer.text : undefined;
                entry.members.push({ name: sym.name, returnType: id });
            }
        }
    }
    function visitFunctionNode(node, symbol) {
        var modifier = ts.getCombinedModifierFlags(node);
        if ((modifier & ts.ModifierFlags.Export) === 0)
            return;
        var entry = serializeMethod(symbol, node);
        if (!entry)
            return;
        entry.entryType = DocEntryType.functionType;
        dtsDeclarations[entry.name] = entry;
    }
    function visitVariableProperties(entry, node) {
        if (!node.initializer)
            return;
        var children = node.initializer.properties;
        if (!Array.isArray(children))
            return;
        for (var i = 0; i < children.length; i++) {
            visitVariableMember(entry, children[i]);
        }
    }
    function visitVariableMember(entry, node) {
        var symbol = checker.getSymbolAtLocation(node.name);
        var memberEntry = serializeClass(symbol, node);
        if (memberEntry) {
            if (!entry.members)
                entry.members = [];
            entry.members.push(memberEntry);
            entry.members.push(memberEntry);
            if (generateDocs) {
                if (entry.entryType === DocEntryType.variableType) {
                    outputPMEs.push(memberEntry);
                    memberEntry.className = entry.name;
                    memberEntry.pmeType = "property";
                    memberEntry.isPublic = true;
                    memberEntry.isField = true,
                        memberEntry.hasSet = true;
                }
            }
            visitVariableProperties(memberEntry, node);
        }
    }
    function visitDocumentedNode(node, symbol) {
        curClass = serializeClass(symbol, node);
        classesHash[curClass.name] = curClass;
        var isOptions = curClass.name.indexOf("IOn") === 0;
        if (!isOptions) {
            outputClasses.push(curClass);
        }
        curJsonName = null;
        ts.forEachChild(node, visitClassNode);
        if (isOptions)
            return;
        if (!curJsonName)
            return;
        curClass.jsonName = curJsonName;
        if (!jsonObjMetaData || !generateDocs)
            return;
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
    function visitClassNode(node) {
        var symbol = null;
        if (node.kind === ts.SyntaxKind.MethodDeclaration)
            symbol = checker.getSymbolAtLocation(node.name);
        if (node.kind === ts.SyntaxKind.FunctionDeclaration)
            symbol = checker.getSymbolAtLocation(node.name);
        if (node.kind === ts.SyntaxKind.PropertyDeclaration)
            symbol = checker.getSymbolAtLocation(node.name);
        if (node.kind === ts.SyntaxKind.GetAccessor)
            symbol = checker.getSymbolAtLocation(node.name);
        if (node.kind === ts.SyntaxKind.SetAccessor)
            symbol = checker.getSymbolAtLocation(node.name);
        if (node.kind === ts.SyntaxKind.PropertySignature)
            symbol = checker.getSymbolAtLocation(node.name);
        if (node.kind === ts.SyntaxKind.MethodSignature)
            symbol = checker.getSymbolAtLocation(node.name);
        if (!symbol)
            return;
        if (!isPMENodeExported(node, symbol))
            return;
        var ser = serializeMember(symbol, node);
        var fullName = ser.name;
        if (curClass) {
            ser.className = curClass.name;
            ser.jsonName = curClass.jsonName;
            fullName = curClass.name + "." + fullName;
            if (!curClass.members)
                curClass.members = [];
            curClass.members.push(ser);
        }
        ser.pmeType = getPMEType(node.kind);
        var modifier = ts.getCombinedModifierFlags(node);
        if ((modifier & ts.ModifierFlags.Static) !== 0) {
            ser.isStatic = true;
        }
        if ((modifier & ts.ModifierFlags.Protected) !== 0) {
            ser.isProtected = true;
        }
        if (node.kind === ts.SyntaxKind.PropertyDeclaration
            && !ser.isLocalizable
            && ser.isField === undefined) {
            ser.isField = true;
        }
        if (node.kind === ts.SyntaxKind.PropertySignature) {
            ser.isField = true;
            ser.isOptional = checker.isOptionalParameter(node);
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
            var serSet = pmesHash[fullName];
            if (serSet) {
                ser.hasSet = serSet.hasSet;
            }
            else
                ser.hasSet = false;
        }
        if (node.kind === ts.SyntaxKind.SetAccessor) {
            var serGet = pmesHash[fullName];
            if (serGet) {
                serGet.hasSet = true;
                ser.isField = false;
            }
            ser = null;
        }
        if (ser) {
            if (!ser.parameters)
                ser.parameters = [];
            pmesHash[fullName] = ser;
            outputPMEs.push(ser);
        }
        if (ser && ser.name === "getType") {
            curJsonName = getJsonTypeName(node);
        }
    }
    function getJsonTypeName(node) {
        var body = node.getFullText();
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
        if (nodeKind === ts.SyntaxKind.MethodDeclaration || nodeKind === ts.SyntaxKind.MethodSignature)
            return "method";
        if (nodeKind === ts.SyntaxKind.FunctionDeclaration)
            return "function";
        return "property";
    }
    function getTypeOfSymbol(symbol) {
        if (symbol.valueDeclaration)
            return checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
        return checker.getDeclaredTypeOfSymbol(symbol);
    }
    function updateEventOptionInterfaceName(node, ser) {
        var typeObj = checker.getTypeAtLocation(node);
        if (!typeObj)
            return;
        var args = typeObj.typeArguments;
        if (!Array.isArray(args) || args.length < 2)
            return;
        ser.eventSenderName = getSymbolName(args[args.length - 2].symbol);
        ser.eventOptionsName = getSymbolName(args[args.length - 1].symbol);
    }
    function getSymbolName(symbol) {
        return !!symbol && !!symbol.name ? symbol.name : "";
    }
    /** Serialize a symbol into a json object */
    function serializeSymbol(symbol) {
        var type = getTypeOfSymbol(symbol);
        var docParts = symbol.getDocumentationComment(undefined);
        var modifiedFlag = !!symbol.valueDeclaration ? ts.getCombinedModifierFlags(symbol.valueDeclaration) : 0;
        var isPublic = (modifiedFlag & ts.ModifierFlags.Public) !== 0;
        var res = {
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
                if (jsTags[i].name == "returns") {
                    res["returnDocumentation"] = jsTags[i].text;
                }
            }
            if (seeArray.length > 0) {
                res["see"] = seeArray;
            }
        }
        return res;
    }
    /** Serialize a class symbol information */
    function serializeClass(symbol, node) {
        var details = serializeSymbol(symbol);
        details.implements = getImplementedTypes(node, details.name);
        setTypeParameters(details.name, node);
        if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            details.entryType = DocEntryType.interfaceType;
        }
        if (node.kind !== ts.SyntaxKind.ClassDeclaration)
            return details;
        // Get the construct signatures
        var constructorType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
        details.entryType = DocEntryType.classType;
        details.constructors = getConstructors(constructorType);
        createPropertiesFromConstructors(details);
        var firstHeritageClauseType = getFirstHeritageClauseType(node);
        details.baseType = getBaseType(firstHeritageClauseType);
        setTypeParameters(details.baseType, firstHeritageClauseType, details.name);
        return details;
    }
    function getConstructors(constructorType) {
        var res = [];
        var signitures = constructorType.getConstructSignatures();
        for (var i = 0; i < signitures.length; i++) {
            if (!signitures[i].declaration)
                continue;
            res.push(serializeSignature(signitures[i]));
        }
        return res;
    }
    function createPropertiesFromConstructors(entry) {
        if (!Array.isArray(entry.constructors))
            return;
        for (var i = 0; i < entry.constructors.length; i++) {
            createPropertiesFromConstructor(entry, entry.constructors[i]);
        }
    }
    function createPropertiesFromConstructor(classEntry, entry) {
        if (!Array.isArray(entry.parameters))
            return;
        for (var i = 0; i < entry.parameters.length; i++) {
            var param = entry.parameters[i];
            if (!param.isPublic)
                continue;
            if (!classEntry.members)
                classEntry.members = [];
            classEntry.members.push({ name: param.name, pmeType: "property", isField: true, isPublic: true, type: param.type });
        }
    }
    function getHeritageClause(node, index) {
        if (!node || !node.heritageClauses || node.heritageClauses.length <= index)
            return undefined;
        return node.heritageClauses[index];
    }
    function getFirstHeritageClauseType(node) {
        var clause = getHeritageClause(node, 0);
        return !!clause ? clause.types[0] : undefined;
    }
    function getImplementedTypes(node, className) {
        if (!node || !node.heritageClauses)
            return undefined;
        var clauses = node.heritageClauses;
        if (!Array.isArray(clauses) || clauses.length == 0)
            return undefined;
        var res = [];
        for (var i = 0; i < clauses.length; i++) {
            getImplementedTypesForClause(res, clauses[i], className);
        }
        return res;
    }
    function getImplementedTypesForClause(res, clause, className) {
        if (!clause || !Array.isArray(clause.types))
            return undefined;
        for (var i = 0; i < clause.types.length; i++) {
            var name_3 = getBaseType(clause.types[i]);
            if (!!name_3) {
                res.push(name_3);
                setTypeParameters(name_3, clause.types[i], className);
            }
        }
    }
    function getBaseType(firstHeritageClauseType) {
        if (!firstHeritageClauseType)
            return "";
        var extendsType = checker.getTypeAtLocation(firstHeritageClauseType.expression);
        var expression = firstHeritageClauseType.expression;
        if (extendsType && extendsType.symbol) {
            var name_4 = extendsType.symbol.name;
            if (!!expression.expression && expression.expression.escapedText)
                return expression.expression.escapedText + "." + name_4;
            return name_4;
        }
        if (!!expression.text)
            return expression.text;
        if (!!expression.expression && !!expression.expression.text && !!expression.name && !!expression.name.text)
            return expression.expression.text + "." + expression.name.text;
        return "";
    }
    function setTypeParameters(typeName, node, forTypeName) {
        if (!typeName || !node)
            return;
        var parameters = getTypedParameters(node, !!forTypeName);
        if (!parameters)
            return;
        if (!forTypeName) {
            dtsTypesParameters[typeName] = parameters;
        }
        else {
            var args = dtsTypesArgumentParameters[typeName];
            if (!args) {
                args = {};
                dtsTypesArgumentParameters[typeName] = args;
            }
            args[forTypeName] = parameters;
        }
    }
    function getTypedParameters(node, isArgument) {
        var params = getTypeParametersDeclaration(node, isArgument);
        if (!params || !Array.isArray(params))
            return undefined;
        var res = [];
        for (var i = 0; i < params.length; i++) {
            var name_5 = getTypeParameterName(params[i], isArgument);
            var extendsType = getTypeParameterConstrains(params[i]);
            res.push(name_5 + extendsType);
        }
        return res.length > 0 ? res : undefined;
    }
    function getTypeParameterName(node, isArgument) {
        var symbol = checker.getSymbolAtLocation(isArgument ? node.typeName : node.name);
        if (!!symbol && symbol.name)
            return symbol.name;
        return "any";
    }
    function getTypeParameterConstrains(node) {
        if (!node["default"])
            return "";
        var first = getTypeParameterName(node["default"], true);
        var second = !!node.constraint ? getTypeParameterName(node.constraint, true) : "";
        if (!first)
            return "";
        if (!!second)
            return " extends " + first + " = " + second;
        return " = " + first;
    }
    function getTypeParametersDeclaration(node, isArgument) {
        if (!node)
            return undefined;
        if (!isArgument && !!node.typeParameters)
            return node.typeParameters;
        if (isArgument && !!node.typeArguments)
            return node.typeArguments;
        if (isArgument && !!node.elementType)
            return [node.elementType];
        return undefined;
    }
    function serializeMember(symbol, node) {
        var details = serializeSymbol(symbol);
        if (getPMEType(node.kind) !== "property") {
            setupMethodInfo(details, symbol, node);
        }
        else {
            details.isLocalizable = getIsPropertyLocalizable(node);
            if (details.isLocalizable) {
                details.hasSet = true;
            }
        }
        return details;
    }
    /** Serialize a method symbol infomration */
    function serializeMethod(symbol, node) {
        var details = serializeSymbol(symbol);
        setupMethodInfo(details, symbol, node);
        return details;
    }
    function setupMethodInfo(entry, symbol, node) {
        var signature = checker.getSignatureFromDeclaration(node);
        var funDetails = serializeSignature(signature);
        entry.parameters = funDetails.parameters;
        entry.returnType = funDetails.returnType;
        entry.typeGenerics = getTypedParameters(node, false);
        entry.returnTypeGenerics = getTypedParameters(node.type, true);
        if (entry.returnType === "Array" && !entry.returnTypeGenerics) {
            entry.returnTypeGenerics = ["any"];
        }
    }
    function getIsPropertyLocalizable(node) {
        if (!Array.isArray(node.decorators))
            return false;
        for (var i = 0; i < node.decorators.length; i++) {
            var decor = node.decorators[i];
            var expression = decor.expression["expression"];
            var decor_arguments = decor.expression["arguments"];
            if (!expression || !Array.isArray(decor_arguments))
                continue;
            var sym = checker.getSymbolAtLocation(expression);
            if (!sym || sym.name !== "property")
                continue;
            for (var j = 0; j < decor_arguments.length; j++) {
                var arg = decor_arguments[j];
                var props = arg["properties"];
                if (!Array.isArray(props))
                    continue;
                for (var k = 0; k < props.length; k++) {
                    var name_6 = props[k]["name"];
                    if (!name_6)
                        continue;
                    var symName = checker.getSymbolAtLocation(name_6);
                    if (!!symName && symName.name === "localizable")
                        return true;
                }
            }
        }
        return false;
    }
    /** Serialize a signature (call or construct) */
    function serializeSignature(signature) {
        var params = signature.parameters;
        var res = {
            parameters: params.map(serializeSymbol),
            returnType: getReturnType(signature),
            documentation: ts.displayPartsToString(signature.getDocumentationComment(undefined))
        };
        for (var i = 0; i < params.length; i++) {
            var node = params[i].valueDeclaration;
            if (!!node) {
                res.parameters[i].isOptional = checker.isOptionalParameter(node);
            }
        }
        return res;
    }
    function getReturnType(signature) {
        var res = checker.typeToString(signature.getReturnType());
        if (res === "{}")
            res = "any";
        if (res !== "any")
            return res;
        var type = signature.declaration.type;
        if (!type)
            return res;
        if (type.kind === ts.SyntaxKind.ArrayType)
            return "Array";
        if (!type["typeName"])
            return res;
        var name = type["typeName"].text;
        return !!name ? name : res;
    }
    /** True if this is visible outside this file, false otherwise */
    function isNodeExported(node) {
        return ((node.flags & ts.NodeFlags["Export"]) !== 0 ||
            (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile));
    }
    function isPMENodeExported(node, symbol) {
        var modifier = ts.getCombinedModifierFlags(node);
        if ((modifier & ts.ModifierFlags.Public) !== 0)
            return true;
        if (generateDts && modifier === 0)
            return true;
        if (generateDts && (modifier & ts.ModifierFlags.Protected) !== 0)
            return true;
        if (node.kind === ts.SyntaxKind.PropertyDeclaration)
            return true;
        if (isSymbolHasComments(symbol))
            return true;
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
    function isSymbolHasComments(symbol) {
        var com = symbol.getDocumentationComment(undefined);
        return com && com.length > 0;
    }
    function isOptionsInterface(name) {
        return name.indexOf("Options") > -1 || name.indexOf("Event") > -1;
    }
    function addClassIntoJSONDefinition(className, isRoot) {
        if (isRoot === void 0) { isRoot = false; }
        if (className == "IElement") {
            className = "SurveyElement";
        }
        if (!!generateJSONDefinitionClasses[className])
            return;
        generateJSONDefinitionClasses[className] = true;
        var cur = classesHash[className];
        if (!isRoot && (!cur || !hasSerializedProperties(className))) {
            addChildrenClasses(className);
            return;
        }
        if (!cur || (!isRoot && hasClassInJSONDefinition(className)))
            return;
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
    function addParentClass(cur, root) {
        if (!cur.baseType)
            return;
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
    function addChildrenClasses(className) {
        for (var i = 0; i < outputClasses.length; i++) {
            if (outputClasses[i].baseType == className) {
                addClassIntoJSONDefinition(outputClasses[i].name);
            }
        }
    }
    function hasClassInJSONDefinition(className) {
        return (!!outputDefinition["definitions"] &&
            !!outputDefinition["definitions"][className]);
    }
    function addPropertiesIntoJSONDefinion(cur, jsonDef) {
        for (var i = 0; i < outputPMEs.length; i++) {
            var property = outputPMEs[i];
            if (property.className !== cur.name || !property.isSerialized)
                continue;
            addPropertyIntoJSONDefinion(property, jsonDef);
        }
    }
    function hasSerializedProperties(className) {
        for (var i = 0; i < outputPMEs.length; i++) {
            var property = outputPMEs[i];
            if (property.className == className && property.isSerialized)
                return true;
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
        var typeInfo = getTypeValue(property);
        var propInfo = { type: typeInfo };
        if (isArray) {
            propInfo = { type: "array", items: typeInfo };
        }
        if (!!property.serializedChoices &&
            Array.isArray(property.serializedChoices) &&
            property.serializedChoices.length > 1) {
            propInfo["enum"] = property.serializedChoices;
        }
        properties[property.name] = propInfo;
    }
    function getTypeValue(property) {
        var propType = property.type;
        if (propType.indexOf("|") > 0)
            return ["boolean", "string"];
        if (propType == "any")
            return ["string", "numeric", "boolean"];
        if (propType == "string" || propType == "numeric" || propType == "boolean")
            return propType;
        var childrenTypes = [];
        addChildrenTypes(propType.replace("[]", ""), childrenTypes);
        if (childrenTypes.length == 1)
            return getReferenceType(childrenTypes[0]);
        if (childrenTypes.length > 1) {
            var res = [];
            for (var i = 0; i < childrenTypes.length; i++) {
                res.push(getReferenceType(childrenTypes[i]));
            }
            return res;
        }
        return getReferenceType(propType.replace("[]", ""));
    }
    function addChildrenTypes(type, childrenTypes) {
        if (type == "IElement")
            type = "SurveyElement";
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
        for (var i_1 = 0; i_1 < outputPMEs.length; i_1++) {
            var ser = outputPMEs[i_1];
            if (!ser.eventSenderName || !ser.eventOptionsName || ser.eventOptionsName === "__type")
                continue;
            if (!ser.documentation)
                ser.documentation = "";
            if (ser.documentation.indexOf("- `sender`:") > -1)
                continue;
            var lines = [];
            lines.push("");
            lines.push("Parameters:");
            lines.push("");
            updateEventDocumentationSender(ser, lines);
            updateEventDocumentationOptions(ser, lines);
            var replacedTextIndex = ser.documentation.indexOf(EventDescriptReplacedText);
            if (replacedTextIndex > -1) {
                ser.documentation = ser.documentation.replace(EventDescriptReplacedText, lines.join("\n"));
            }
            else {
                lines.unshift("");
                ser.documentation += lines.join("\n");
            }
        }
    }
    function updateEventDocumentationSender(ser, lines) {
        if (!ser.eventSenderName)
            return;
        var desc = "";
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
    function updateEventDocumentationOptions(ser, lines) {
        if (!ser.eventOptionsName)
            return;
        var members = {};
        fillEventMembers(ser.eventOptionsName, members);
        for (var key_1 in members) {
            var m = members[key_1];
            var doc = m.documentation;
            if (isHiddenEntryByDoc(doc))
                continue;
            lines.push("- `options." + m.name + "`: `" + m.type + "`" + (!!doc ? "  " : ""));
            if (!!doc) {
                lines.push(doc);
            }
        }
        ;
    }
    function isHiddenEntryByDoc(doc) {
        if (!doc)
            return true;
        doc = doc.toLocaleLowerCase();
        return doc.startsWith("obsolete") || doc.startsWith("for internal use");
    }
    function fillEventMembers(interfaceName, members) {
        var classEntry = classesHash[interfaceName];
        if (!classEntry)
            return;
        if (Array.isArray(classEntry.implements)) {
            for (var i_2 = 0; i_2 < classEntry.implements.length; i_2++) {
                fillEventMembers(classEntry.implements[i_2], members);
            }
        }
        if (!Array.isArray(classEntry.members))
            return;
        for (var i_3 = 0; i_3 < classEntry.members.length; i_3++) {
            var m = classEntry.members[i_3];
            members[m.name] = m;
        }
    }
    function getReferenceType(type) {
        var curClass = classesHash[type];
        if (!curClass)
            return type;
        return { $href: "#" + curClass.jsonName };
    }
    function dtsImportFiles(imports) {
        if (!imports)
            return;
        for (var key in imports) {
            var arr = imports[key];
            if (!Array.isArray(arr))
                continue;
            for (var i = 0; i < arr.length; i++) {
                importDtsFile(key, arr[i]);
            }
        }
    }
    function importDtsFile(moduleName, fileName) {
        var text = fs.readFileSync(getAbsoluteFileName(fileName), 'utf8');
        var regExStrs = [{ regex: /(?<=export interface)(.*)(?={)/gm, type: DocEntryType.interfaceType },
            { regex: /(?<=export declare var)(.*)(?=:)/gm, type: DocEntryType.variableType },
            { regex: /(?<=export declare function)(.*)(?=\()/gm, type: DocEntryType.functionType },
            { regex: /(?<=export declare class)(.*)(?={)/gm, type: DocEntryType.classType },
            { regex: /(?<=export declare class)(.*)(?=extends)/gm, type: DocEntryType.classType },
            { regex: /(?<=export declare class)(.*)(?=implements)/gm, type: DocEntryType.classType },
            { regex: /(?<=export declare class)(.*)(?=<)/gm, type: DocEntryType.classType }];
        var removedWords = [" extends ", "<"];
        var _loop_1 = function () {
            var item = regExStrs[i];
            var mathArray = text.match(item.regex);
            if (!Array.isArray(mathArray))
                return "continue";
            mathArray.forEach(function (name) {
                if (!!name && !!name.trim()) {
                    for (var rI = 0; rI < removedWords.length; rI++) {
                        var index = name.indexOf(removedWords[rI]);
                        if (index > -1) {
                            name = name.substring(0, index);
                        }
                    }
                    dtsImports[name.trim()] = { name: name.trim(), moduleName: moduleName, entryType: item.type };
                }
            });
        };
        for (var i = 0; i < regExStrs.length; i++) {
            _loop_1();
        }
    }
    function prepareDtsInfo() {
        for (var key in classesHash) {
            proccessDtsClass(classesHash[key]);
        }
    }
    function proccessDtsClass(curClass) {
        dtsDeclarations[curClass.name] = curClass;
    }
    function dtsGetText() {
        var lines = [];
        dtsRenderDeclarations(lines);
        return lines.join("\n");
    }
    function dtsRenderDeclarations(lines) {
        var classes = [];
        var interfaces = [];
        var functions = [];
        var variables = [];
        var enums = [];
        for (var key in dtsDeclarations) {
            if (dtsExcludeImports && !!dtsImports[key])
                continue;
            var cur = dtsDeclarations[key];
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
        for (var i = 0; i < dtsExportClassesFromLibraries.length; i++) {
            dtsRenderExportClassFromLibraries(lines, dtsExportClassesFromLibraries[i]);
        }
        if (dtsExportClassesFromLibraries.length > 0) {
            lines.push("");
        }
        dtsSortClasses(classes);
        for (var i = 0; i < enums.length; i++) {
            dtsRenderDeclarationEnum(lines, enums[i]);
        }
        for (var i = 0; i < interfaces.length; i++) {
            dtsRenderDeclarationInterface(lines, interfaces[i]);
        }
        for (var i = 0; i < classes.length; i++) {
            dtsRenderDeclarationClass(lines, classes[i]);
        }
        for (var i = 0; i < functions.length; i++) {
            dtsRenderDeclarationFunction(lines, functions[i]);
        }
        for (var i = 0; i < variables.length; i++) {
            dtsRenderDeclarationVariable(lines, variables[i], 0);
        }
        dtsRenderImports(lines);
    }
    function dtsSortClasses(classes) {
        classes.sort(function (a, b) {
            if (a.allTypes.indexOf(b.name) > -1)
                return 1;
            if (b.allTypes.indexOf(a.name) > -1)
                return -1;
            if (a.allTypes.length !== b.allTypes.length) {
                return a.allTypes.length > b.allTypes.length ? 1 : -1;
            }
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
    }
    function dtsRenderImports(lines) {
        var modules = {};
        for (key in dtsImportDeclarations) {
            var entry = dtsImportDeclarations[key];
            var arr = modules[entry.moduleName];
            if (!arr) {
                arr = [];
                modules[entry.moduleName] = arr;
            }
            arr.push(key);
        }
        var importLines = [];
        for (key in modules) {
            var arr = modules[key];
            while (arr.length > 0) {
                var renderedArr = arr.splice(0, 5);
                var str = "import { " + renderedArr.join(", ") + " } from \"" + key + "\";";
                importLines.push(str);
            }
        }
        for (var key in dtsFrameworksImportDeclarations) {
            importLines.push(dtsFrameworksImportDeclarations[key] + " from \"" + key + "\";");
        }
        if (importLines.length > 0) {
            lines.unshift("");
        }
        for (var i_4 = importLines.length - 1; i_4 >= 0; i_4--) {
            lines.unshift(importLines[i_4]);
        }
    }
    function dtsRenderExportClassFromLibraries(lines, entry) {
        if (!!dtsExportedClasses[entry.name])
            return;
        dtsExportedClasses[entry.name] = true;
        var str = "export { ";
        if (!!entry.className) {
            str += entry.className + " as ";
        }
        str += entry.name + " }";
        if (!!entry.fileName) {
            str += " from \"" + entry.fileName + "\"";
        }
        str += ";";
        lines.push(str);
    }
    function dtsRenderDeclarationClass(lines, entry) {
        if (entry.name === "default")
            return;
        dtsRenderDoc(lines, entry);
        var line = "export declare ";
        line += "class " + entry.name + dtsGetTypeGeneric(entry.name) + dtsRenderClassExtend(entry) + " {";
        lines.push(line);
        dtsRenderDeclarationConstructor(lines, entry);
        dtsRenderDeclarationBody(lines, entry);
        lines.push("}");
    }
    function dtsRenderDeclarationInterface(lines, entry) {
        dtsRenderDoc(lines, entry);
        var impl = dtsRenderImplementedInterfaces(entry, false);
        var line = "export interface " + dtsGetType(entry.name) + dtsGetTypeGeneric(entry.name) + impl + " {";
        lines.push(line);
        dtsRenderDeclarationBody(lines, entry);
        lines.push("}");
    }
    function dtsRenderDeclarationVariable(lines, entry, level) {
        dtsRenderDoc(lines, entry, level);
        var line = (level === 0 ? "export declare var " : dtsAddSpaces(level)) + entry.name + ": ";
        var hasMembers = Array.isArray(entry.members);
        var comma = level === 0 ? ";" : ",";
        line += hasMembers ? "{" : (dtsGetType(entry.type) + comma);
        lines.push(line);
        if (hasMembers) {
            for (var i = 0; i < entry.members.length; i++) {
                if (dtsIsPrevMemberTheSame(entry.members, i))
                    continue;
                dtsRenderDeclarationVariable(lines, entry.members[i], level + 1);
            }
            lines.push(dtsAddSpaces(level) + "}" + comma);
        }
    }
    function dtsRenderDeclarationEnum(lines, entry) {
        if (!Array.isArray(entry.members) || entry.members.length === 0)
            return;
        lines.push("export enum " + entry.name + " {");
        for (var i = 0; i < entry.members.length; i++) {
            var m = entry.members[i];
            var comma = i < entry.members.length - 1 ? "," : "";
            lines.push(dtsAddSpaces() + m.name + (!!m.returnType ? " = " + m.returnType : "") + comma);
        }
        lines.push("}");
    }
    function dtsRenderDeclarationFunction(lines, entry) {
        lines.push("export declare function " + dtsGetFunctionDeclaration(entry));
    }
    function dtsRenderClassExtend(cur) {
        if (!cur.baseType)
            return "";
        if (!dtsGetHasClassType(cur.baseType))
            return "";
        var entry = dtsDeclarations[cur.baseType];
        if (!entry) {
            entry = dtsImports[cur.baseType];
        }
        var isInteface = !!entry && entry.entryType === DocEntryType.interfaceType;
        var impl = dtsRenderImplementedInterfaces(cur, !isInteface);
        if (isInteface)
            return impl;
        var generic = dtsGetTypeGeneric(cur.baseType, cur.name);
        return " extends " + cur.baseType + generic + impl;
    }
    function dtsRenderImplementedInterfaces(entry, isBaseClass) {
        if (!Array.isArray(entry.implements))
            return "";
        var impls = entry.implements;
        if (impls.length === 0)
            return "";
        var res = [];
        for (var i = 0; i < impls.length; i++) {
            if (isBaseClass && impls[i] === entry.baseType)
                continue;
            var generic = dtsGetTypeGeneric(impls[i], entry.name);
            dtsAddImportDeclaration(impls[i]);
            res.push(impls[i] + generic);
        }
        if (res.length === 0)
            return "";
        var ext = entry.entryType === DocEntryType.interfaceType ? " extends " : " implements ";
        return ext + res.join(", ");
    }
    function dtsRenderDeclarationBody(lines, entry) {
        if (!Array.isArray(entry.members))
            return;
        var members = [].concat(entry.members);
        for (var i = 0; i < members.length; i++) {
            if (dtsIsPrevMemberTheSame(members, i))
                continue;
            var member = members[i];
            dtsRenderDeclarationMember(lines, member);
            if (member.isLocalizable) {
                var name_7 = "loc" + member.name[0].toUpperCase() + member.name.substring(1);
                if (dtsHasMemberInEntry(entry, name_7))
                    continue;
                var locMember = { name: name_7, type: "LocalizableString", hasSet: false, pmeType: "property" };
                dtsRenderDeclarationMember(lines, locMember);
            }
        }
    }
    function dtsHasMemberInEntry(entry, name) {
        if (!Array.isArray(entry.members))
            return;
        for (var i = 0; i < entry.members.length; i++) {
            if (entry.members[i].name === name)
                return true;
        }
        return false;
    }
    function dtsRenderDeclarationConstructor(lines, entry) {
        if (!Array.isArray(entry.constructors))
            return;
        for (var i = 0; i < entry.constructors.length; i++) {
            var parameters = dtsGetParameters(entry.constructors[i]);
            lines.push(dtsAddSpaces() + "constructor(" + parameters + ");");
        }
    }
    function dtsRenderDeclarationMember(lines, member) {
        var prefix = dtsAddSpaces() + (member.isProtected ? "protected " : "") + (member.isStatic ? "static " : "");
        dtsRenderDoc(lines, member, 1);
        var importType = "";
        if (member.pmeType === "function" || member.pmeType === "method") {
            importType = member.returnType;
            lines.push(prefix + dtsGetFunctionDeclaration(member));
        }
        if (member.pmeType === "property") {
            var propType = dtsGetType(member.type);
            importType = member.type;
            if (member.isField) {
                lines.push(prefix + member.name + (member.isOptional ? "?" : "") + ": " + propType + ";");
            }
            else {
                lines.push(prefix + "get " + member.name + "(): " + propType + ";");
                if (member.hasSet) {
                    lines.push(prefix + "set " + member.name + "(val: " + propType + ");");
                }
            }
        }
        if (member.pmeType === "event") {
            importType = member.type;
            lines.push(prefix + member.name + ": " + member.type + ";");
        }
        dtsAddImportDeclaration(removeGenerics(importType));
    }
    function dtsGetFunctionDeclaration(entry) {
        var parStr = dtsGetFunctionParametersDeclaration(entry);
        return entry.name + dtsGetGenericTypes(entry.typeGenerics) + parStr + ";";
    }
    function dtsGetFunctionParametersDeclaration(entry, isParameter) {
        if (isParameter === void 0) { isParameter = false; }
        var returnType = removeGenerics(entry.returnType);
        returnType = dtsGetType(returnType);
        if (returnType !== "any") {
            returnType += dtsGetGenericTypes(entry.returnTypeGenerics);
        }
        var parameters = dtsGetParameters(entry);
        return "(" + parameters + ")" + (isParameter ? " => " : ": ") + returnType;
    }
    function removeGenerics(typeName) {
        if (!typeName)
            return typeName;
        if (typeName[typeName.length - 1] !== ">")
            return typeName;
        var index = typeName.indexOf("<");
        if (index < 0)
            return typeName;
        return typeName.substring(0, index);
    }
    function dtsGetGenericTypes(generic) {
        if (!Array.isArray(generic) || generic.length === 0)
            return "";
        return "<" + generic.join(", ") + ">";
    }
    function dtsRenderDoc(lines, entry, level) {
        if (level === void 0) { level = 0; }
        if (!entry.documentation)
            return;
        var docLines = entry.documentation.split("\n");
        lines.push(dtsAddSpaces(level) + "/*");
        for (var i = 0; i < docLines.length; i++) {
            lines.push(dtsAddSpaces(level) + "* " + docLines[i]);
        }
        lines.push(dtsAddSpaces(level) + "*/");
    }
    function dtsGetType(type) {
        if (!type)
            return "void";
        if (type === "T")
            return type;
        if (type.indexOf("|") > -1) {
            return type.indexOf("(") > -1 ? "any" : type;
        }
        var str = type.replace("[", "").replace("]", "");
        if (str === "number" || str === "boolean" || str === "string" || str === "any" || str === "void")
            return type;
        if (type[0] === "(" && type.indexOf(callbackFuncResultStr) > -1)
            return dtsGetTypeAsFunc(type);
        return dtsPlatformType(str, type);
    }
    function dtsPlatformType(str, type) {
        if (!dtsGetHasClassType(str))
            return "any";
        if (isReactElement(type))
            return "JSX.Element";
        return type;
    }
    function dtsGetTypeAsFunc(type) {
        var index = type.indexOf(callbackFuncResultStr);
        var entry = {};
        entry.returnType = type.substring(index + callbackFuncResultStr.length);
        var paramsStr = type.substring(1, index).split(",");
        entry.parameters = [];
        for (var i = 0; i < paramsStr.length; i++) {
            var par = paramsStr[i];
            var parIndex = par.indexOf(":");
            if (parIndex < 0)
                return "any";
            entry.parameters.push({ name: par.substring(0, parIndex).trim(), type: par.substring(parIndex + 1).trim() });
        }
        return dtsGetFunctionParametersDeclaration(entry, true);
    }
    function dtsGetTypeGeneric(type, typeFor) {
        if (!type)
            return "";
        if (!typeFor)
            return dtsGetTypeGenericByParameters(dtsTypesParameters[type]);
        var args = dtsTypesArgumentParameters[type];
        if (!args)
            return "";
        return dtsGetTypeGenericByParameters(args[typeFor]);
    }
    function dtsGetTypeGenericByParameters(params) {
        if (!Array.isArray(params))
            return "";
        for (var i = 0; i < params.length; i++) {
            dtsAddImportDeclaration(params[i]);
        }
        return "<" + params.join(", ") + ">";
    }
    function isReactElement(type) {
        return isExportingReact && type === "Element";
    }
    function dtsGetHasClassType(type) {
        if (dtsAddImportDeclaration(type))
            return true;
        if (type === "Array")
            return true;
        if (isReactElement(type))
            return true;
        return !!dtsDeclarations[type];
    }
    function dtsAddImportDeclaration(type) {
        if (!type)
            return false;
        if (type.indexOf("React.") === 0) {
            dtsFrameworksImportDeclarations["react"] = "import * as React";
            isExportingReact = true;
            return true;
        }
        if (type === "Vue") {
            dtsFrameworksImportDeclarations["vue"] = "import Vue";
            return true;
        }
        if (!dtsExcludeImports && !!dtsDeclarations[type])
            return false;
        var entry = dtsImports[type];
        if (!entry)
            return false;
        dtsImportDeclarations[type] = entry;
        return true;
    }
    function dtsIsPrevMemberTheSame(members, index) {
        return index > 0 && members[index].name === members[index - 1].name;
    }
    function dtsGetParameters(member) {
        if (!Array.isArray(member.parameters))
            return "";
        var strs = [];
        var params = member.parameters;
        for (var i = 0; i < params.length; i++) {
            var p = params[i];
            var typeStr = dtsGetType(p.type);
            //We have Event in library core and there is Event in DOM.
            if (typeStr === "Event")
                typeStr = "any";
            strs.push(p.name + (p.isOptional ? "?" : "") + ": " + typeStr);
        }
        return strs.join(", ");
    }
    function dtsAddSpaces(level) {
        if (level === void 0) { level = 1; }
        var str = "";
        for (var i = 0; i < level; i++)
            str += "  ";
        return str;
    }
}
exports.generateDocumentation = generateDocumentation;
