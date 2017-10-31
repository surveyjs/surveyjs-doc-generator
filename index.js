"use strict";
exports.__esModule = true;
var ts = require("typescript");
var fs = require("fs");
;
var jsonObjMetaData = null;
function setJsonObj(obj) {
    jsonObjMetaData = obj;
}
exports.setJsonObj = setJsonObj;
/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(fileNames, options) {
    // Build a program using the set of root file names in fileNames
    var program = ts.createProgram(fileNames, options);
    // Get the checker, we will use it to find more about classes
    var checker = program.getTypeChecker();
    var outputClasses = [];
    var outputPMEs = [];
    var pmesHash = {};
    var classesHash = {};
    var curClass = null;
    var curJsonName = null;
    // Visit every sourceFile in the program    
    for (var _i = 0, _a = program.getSourceFiles(); _i < _a.length; _i++) {
        var sourceFile = _a[_i];
        if (sourceFile.fileName.indexOf("node_modules") > 0)
            continue;
        // Walk the tree to search for classes
        ts.forEachChild(sourceFile, visit);
    }
    for (var key in classesHash) {
        setAllParentTypes(key);
    }
    // print out the doc
    fs.writeFileSync(process.cwd() + "/doc_generator/classes.json", JSON.stringify(outputClasses, undefined, 4));
    fs.writeFileSync(process.cwd() + "/doc_generator/pmes.json", JSON.stringify(outputPMEs, undefined, 4));
    return;
    /** set allParentTypes */
    function setAllParentTypes(className) {
        if (!className)
            return;
        var curClass = classesHash[className];
        if (curClass.allTypes && curClass.allTypes.length > 0)
            return;
        curClass.allTypes = [];
        curClass.allTypes.push(curClass.name);
        if (!curClass.baseType)
            return;
        var baseClass = classesHash[curClass.baseType];
        if (baseClass && baseClass.allTypes) {
            for (var i = 0; i < baseClass.allTypes.length; i++) {
                curClass.allTypes.push(baseClass.allTypes[i]);
            }
        }
    }
    /** visit nodes finding exported classes */
    function visit(node) {
        // Only consider exported nodes
        if (!isNodeExported(node))
            return;
        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
            // This is a top level class, get its symbol
            var symbol = checker.getSymbolAtLocation(node.name);
            if (isSymbolHasComments(symbol)) {
                visitDocumentedNode(node, symbol);
            }
        }
        else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            // This is a top level class, get its symbol
            var symbol = checker.getSymbolAtLocation(node.name);
            if (isSymbolHasComments(symbol)) {
                visitDocumentedNode(node, symbol);
            }
        }
        else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
            // This is a namespace, visit its children
            ts.forEachChild(node, visit);
        }
    }
    function visitDocumentedNode(node, symbol) {
        curClass = serializeClass(symbol, node);
        classesHash[curClass.name] = curClass;
        outputClasses.push(curClass);
        curJsonName = null;
        ts.forEachChild(node, visitClassNode);
        if (!curJsonName)
            return;
        curClass.jsonName = curJsonName;
        if (!jsonObjMetaData)
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
                        break;
                    }
                }
            }
        }
    }
    function visitClassNode(node) {
        if (!isPMENodeExported(node))
            return;
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
        if (symbol) {
            var ser = serializeMethod(symbol, node);
            var fullName = ser.name;
            if (curClass) {
                ser.className = curClass.name;
                fullName = curClass.name + '.' + fullName;
            }
            ser.pmeType = getPMEType(node.kind);
            if (ser.type.indexOf("Event") === 0)
                ser.pmeType = "event";
            if (node.kind === ts.SyntaxKind.GetAccessor) {
                var serSet = pmesHash[fullName];
                if (serSet) {
                    ser.hasSet = serSet.hasSet;
                }
                else
                    ser.hasSet = false;
            }
            if (node.kind === ts.SyntaxKind.SetAccessor) {
                var serGet = pmesHash[fullName];
                if (serGet)
                    serGet.hasSet = true;
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
            if (isSymbolHasComments(symbol)) {
            }
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
    function getPMEType(nodeKind) {
        if (nodeKind === ts.SyntaxKind.MethodDeclaration)
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
    /** Serialize a symbol into a json object */
    function serializeSymbol(symbol) {
        var type = getTypeOfSymbol(symbol);
        var res = {
            name: symbol.getName(),
            documentation: ts.displayPartsToString(symbol.getDocumentationComment()),
            type: checker.typeToString(type)
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
    /** Serialize a class symbol infomration */
    function serializeClass(symbol, node) {
        var details = serializeSymbol(symbol);
        if (node.kind !== ts.SyntaxKind.ClassDeclaration)
            return details;
        // Get the construct signatures
        var constructorType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
        details.constructors = constructorType.getConstructSignatures().map(serializeSignature);
        //get base class
        details.baseType = "";
        var classDeclaration = node;
        if (classDeclaration && classDeclaration.heritageClauses && classDeclaration.heritageClauses.length > 0) {
            var firstHeritageClause = classDeclaration.heritageClauses[0];
            var firstHeritageClauseType = firstHeritageClause.types[0];
            var extendsType = checker.getTypeAtLocation(firstHeritageClauseType.expression);
            if (extendsType) {
                details.baseType = extendsType.symbol.name;
            }
        }
        return details;
    }
    /** Serialize a method symbol infomration */
    function serializeMethod(symbol, node) {
        var details = serializeSymbol(symbol);
        if (node.kind === ts.SyntaxKind.MethodDeclaration || node.kind === ts.SyntaxKind.FunctionDeclaration) {
            var signature = checker.getSignatureFromDeclaration(node);
            var funDetails = serializeSignature(signature);
            details.parameters = funDetails.parameters;
            if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
                details.returnType = funDetails.returnType;
            }
        }
        return details;
    }
    /** Serialize a signature (call or construct) */
    function serializeSignature(signature) {
        return {
            parameters: signature.parameters.map(serializeSymbol),
            returnType: checker.typeToString(signature.getReturnType()),
            documentation: ts.displayPartsToString(signature.getDocumentationComment())
        };
    }
    /** True if this is visible outside this file, false otherwise */
    function isNodeExported(node) {
        return (node.flags & ts.NodeFlags["Export"]) !== 0 || (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile);
    }
    function isPMENodeExported(node) {
        var modifier = ts.getCombinedModifierFlags(node);
        if ((modifier & ts.ModifierFlags.Public) !== 0)
            return true;
        var parent = node.parent;
        return parent && (parent.kind === ts.SyntaxKind.InterfaceDeclaration);
    }
    /** True if there is a comment before declaration */
    function isSymbolHasComments(symbol) {
        var com = symbol.getDocumentationComment();
        return com && com.length > 0;
    }
}
exports.generateDocumentation = generateDocumentation;
