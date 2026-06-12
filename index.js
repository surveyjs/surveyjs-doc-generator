"use strict";
exports.__esModule = true;
exports.generateDocumentation = exports.setJsonObj = void 0;
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
var jsonObjMetaData = null;
var stringLiteralTypes = {};
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
/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(fileNames, options, docOptions) {
    if (docOptions === void 0) { docOptions = {}; }
    var vueGeneratedFiles = [];
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
    var generateJSONDefinition = docOptions.generateJSONDefinition === true;
    var outputDefinition = {};
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
    updateEventsDocumentation();
    updateHiddenForEntriesDoc();
    // print out the doc
    fs.writeFileSync(process.cwd() + "/docs/classes.json", JSON.stringify(outputClasses, undefined, 4));
    fs.writeFileSync(process.cwd() + "/docs/pmes.json", JSON.stringify(outputPMEs, undefined, 4));
    if (generateJSONDefinition) {
        outputDefinition["$schema"] = "http://json-schema.org/draft-07/schema#";
        outputDefinition["title"] = "SurveyJS Library json schema";
        addClassIntoJSONDefinition("SurveyModel", true);
        fs.writeFileSync(process.cwd() + "/docs/surveyjs_definition.json", JSON.stringify(outputDefinition, undefined, 4));
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
                vueGeneratedFiles.push(absFileName);
                fs.writeFileSync(absFileName, vue_tsText);
            }
        }
    }
    function deleteVueTSFiles() {
        for (var i = 0; i < vueGeneratedFiles.length; i++) {
            fs.unlinkSync(vueGeneratedFiles[i]);
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
        if (node.kind === ts.SyntaxKind.VariableStatement) {
            var vsNode = node;
            if (vsNode.declarationList.declarations.length > 0) {
                var varNode = vsNode.declarationList.declarations[0];
                var symbol = checker.getSymbolAtLocation(varNode.name);
                if (!!symbol && isSymbolHasComments(symbol)) {
                    visitVariableNode(varNode, symbol);
                }
            }
        }
        else if (node.kind === ts.SyntaxKind.ClassDeclaration) {
            // This is a top level class, get its symbol
            var symbol = checker.getSymbolAtLocation(node.name);
            if (!symbol)
                return;
            if (isSymbolHasComments(symbol)) {
                visitDocumentedNode(node, symbol);
            }
        }
        else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            // This is a top level class, get its symbol
            var name_1 = node.name;
            var symbol = checker.getSymbolAtLocation(name_1);
            if (isSymbolHasComments(symbol) || isOptionsInterface(name_1.text)) {
                visitDocumentedNode(node, symbol);
            }
        }
        else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
            // This is a namespace, visit its children
            ts.forEachChild(node, visit);
        }
        else if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
            visitExportTypeAliasNode(node);
        }
    }
    function visitExportTypeAliasNode(node) {
        var type = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(node.name));
        var types = type.types;
        if (Array.isArray(types) && types.length > 0) {
            var literals = [];
            for (var i_1 = 0; i_1 < types.length; i_1++) {
                if (typeof types[i_1].value === "string") {
                    literals.push("\"" + types[i_1].value + "\"");
                }
            }
            if (types.length === literals.length) {
                stringLiteralTypes[node.name.text] = literals.join(" | ");
            }
        }
    }
    function visitVariableNode(node, symbol) {
        var entry = serializeSymbol(symbol);
        entry.entryType = DocEntryType.variableType;
        visitVariableProperties(entry, node);
        entry.allTypes = [entry.name];
        entry.isPublic = true;
        outputClasses.push(entry);
        entry.members = [];
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
            if (entry.entryType === DocEntryType.variableType) {
                outputPMEs.push(memberEntry);
                memberEntry.className = entry.name;
                memberEntry.pmeType = "property";
                memberEntry.isPublic = true;
                memberEntry.isField = true,
                    memberEntry.hasSet = true;
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
        if (!jsonObjMetaData)
            return;
        var properties = jsonObjMetaData.getProperties(curJsonName);
        var classInfo = jsonObjMetaData.findClass(curJsonName);
        var hiddenProps = {};
        var parentHiddenClasses = [];
        for (var i_2 = 0; i_2 < properties.length; i_2++) {
            var prop = properties[i_2];
            if (prop.visible === false && !!classInfo.parentName) {
                var parentClassInfo = jsonObjMetaData.findClass(classInfo.parentName);
                var parentProp = jsonObjMetaData.findProperty(parentClassInfo.name, prop.name);
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
        for (var i_3 = 0; i_3 < outputPMEs.length; i_3++) {
            var pme = outputPMEs[i_3];
            if (pme.pmeType !== "property")
                continue;
            if (parentHiddenClasses.length > 0 && classesHash[pme.className]) {
                var pmeJsonName = pme.jsonName || classesHash[pme.className].jsonName;
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
                var prop = jsonObjMetaData.findProperty(curJsonName, pme.name);
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
            if (!hasMembers(curClass, ser.name)) {
                curClass.members.push(ser);
            }
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
            //if (!ser.documentation && (ser.eventSenderName === "__type" || !ser.eventOptionsName)) {
            //Remove any event if there is no documentation 
            if (!ser.documentation) {
                ser = null;
            }
        }
        if (ser && node.kind === ts.SyntaxKind.GetAccessor) {
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
    function hasMembers(entry, name) {
        if (!entry || !Array.isArray(entry.members))
            return false;
        for (var i = 0; i < entry.members.length; i++) {
            if (entry.members[i].name === name)
                return true;
        }
        return false;
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
        if (stringLiteralTypes[res.type]) {
            res.type = stringLiteralTypes[res.type];
        }
        if (!!type.symbol && !!type.symbol.valueDeclaration && type.symbol.valueDeclaration.kind === ts.SyntaxKind.FunctionExpression) {
            var signature = checker.getSignatureFromDeclaration(type.symbol.valueDeclaration);
            var funDetails = serializeSignature(signature);
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
                    var text = jsTags[i].text;
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
                    var hideFor = jsTags[i].text;
                    if (!!hideFor) {
                        var hideForVal = hideFor.split(",").map(function (item) { return item.trim(); });
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
    /** Serialize a class symbol information */
    function serializeClass(symbol, node) {
        var details = serializeSymbol(symbol);
        details.implements = getImplementedTypes(node, details.name);
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
            var name_2 = getBaseType(clause.types[i]);
            if (!!name_2) {
                res.push(name_2);
            }
        }
    }
    function getBaseType(firstHeritageClauseType) {
        if (!firstHeritageClauseType)
            return "";
        var expression = firstHeritageClauseType.expression;
        // Handle mixin pattern: extends mixinFunction(BaseClass)
        if (expression.kind === ts.SyntaxKind.CallExpression && expression.arguments && expression.arguments.length > 0) {
            var arg = expression.arguments[0];
            var argType = checker.getTypeAtLocation(arg);
            if (argType && argType.symbol) {
                return argType.symbol.name;
            }
            if (arg.escapedText)
                return arg.escapedText;
            if (arg.text)
                return arg.text;
            return "";
        }
        var extendsType = checker.getTypeAtLocation(firstHeritageClauseType.expression);
        if (extendsType && extendsType.symbol) {
            var name_3 = extendsType.symbol.name;
            if (!!expression.expression && expression.expression.escapedText)
                return expression.expression.escapedText + "." + name_3;
            return name_3;
        }
        if (!!expression.text)
            return expression.text;
        if (!!expression.expression && !!expression.expression.text && !!expression.name && !!expression.name.text)
            return expression.expression.text + "." + expression.name.text;
        return "";
    }
    function getTypedParameters(node, isArgument) {
        var params = getTypeParametersDeclaration(node, isArgument);
        if (!params || !Array.isArray(params))
            return undefined;
        var res = [];
        for (var i = 0; i < params.length; i++) {
            var name_4 = getTypeParameterName(params[i], isArgument);
            var extendsType = getTypeParameterConstrains(params[i]);
            res.push(name_4 + extendsType);
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
        if (entry.parameters && entry.parameters.length > 0) {
            addNestedParameters(entry.parameters, node);
        }
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
                    var name_5 = props[k]["name"];
                    if (!name_5)
                        continue;
                    var symName = checker.getSymbolAtLocation(name_5);
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
    function addNestedParameters(parameters, node) {
        if (node.jsDoc && node.jsDoc.length > 0) {
            var jsDoc = node.jsDoc[0];
            if (jsDoc.tags) {
                jsDoc.tags.forEach(function (tag) {
                    if (tag.tagName.text === "param" && tag.typeExpression && tag.name && tag.name.left && tag.name.right) {
                        var paramName = tag.name.left.text;
                        var nextedParam = tag.name.right.text;
                        var paramType = checker.getTypeAtLocation(tag.typeExpression.type);
                        parameters.push({ name: paramName + "." + nextedParam, type: checker.typeToString(paramType), documentation: tag.comment });
                    }
                });
            }
        }
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
        for (var i_4 = 0; i_4 < outputPMEs.length; i_4++) {
            var ser = outputPMEs[i_4];
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
    function updateHiddenForEntriesDoc() {
        var addedEntries = [];
        var _loop_1 = function (i_5) {
            var ser = outputPMEs[i_5];
            if (Array.isArray(ser.hideForClasses)) {
                ser.hideForClasses.forEach(function (className) {
                    hideEntryForClass(ser, className, addedEntries);
                });
            }
            if (ser.isHidden === true && !!ser.className) {
                outputClasses.forEach(function (cls) {
                    if (cls.name !== ser.className && Array.isArray(cls.allTypes)
                        && cls.allTypes.indexOf(ser.className) > -1) {
                        hideEntryForClass(ser, cls.name, addedEntries);
                    }
                });
            }
        };
        for (var i_5 = 0; i_5 < outputPMEs.length; i_5++) {
            _loop_1(i_5);
        }
        addedEntries.forEach(function (entry) {
            outputPMEs.push(entry);
        });
    }
    function hideEntryForClass(ser, className, addedEntries) {
        var classEntry = classesHash[className];
        if (!classEntry)
            return;
        if (!Array.isArray(classEntry.members)) {
            classEntry.members = [];
        }
        var entry = classEntry.members.find(function (item) { return item.name === ser.name; });
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
            if (m.isHidden === true || isHiddenEntryByDoc(doc))
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
            for (var i_6 = 0; i_6 < classEntry.implements.length; i_6++) {
                fillEventMembers(classEntry.implements[i_6], members);
            }
        }
        if (!Array.isArray(classEntry.members))
            return;
        for (var i_7 = 0; i_7 < classEntry.members.length; i_7++) {
            var m = classEntry.members[i_7];
            members[m.name] = m;
        }
    }
    function getReferenceType(type) {
        var curClass = classesHash[type];
        if (!curClass)
            return type;
        return { $href: "#" + curClass.jsonName };
    }
}
exports.generateDocumentation = generateDocumentation;
