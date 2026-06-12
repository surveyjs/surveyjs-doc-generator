"use strict";
exports.__esModule = true;
exports.serializeSignature = exports.serializeMethod = exports.serializeMember = exports.getBaseType = exports.serializeClass = exports.serializeSymbol = exports.updateEventOptionInterfaceName = void 0;
var ts = require("typescript");
var types_1 = require("./types");
var state_1 = require("./state");
var ast_utils_1 = require("./ast-utils");
function getTypeOfSymbol(ctx, symbol) {
    if (symbol.valueDeclaration)
        return ctx.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    return ctx.checker.getDeclaredTypeOfSymbol(symbol);
}
function updateEventOptionInterfaceName(ctx, node, ser) {
    var typeObj = ctx.checker.getTypeAtLocation(node);
    if (!typeObj)
        return;
    var args = typeObj.typeArguments;
    if (!Array.isArray(args) || args.length < 2)
        return;
    ser.eventSenderName = getSymbolName(args[args.length - 2].symbol);
    ser.eventOptionsName = getSymbolName(args[args.length - 1].symbol);
}
exports.updateEventOptionInterfaceName = updateEventOptionInterfaceName;
function getSymbolName(symbol) {
    return !!symbol && !!symbol.name ? symbol.name : "";
}
/** Serialize a symbol into a json object */
function serializeSymbol(ctx, symbol) {
    var checker = ctx.checker;
    var type = getTypeOfSymbol(ctx, symbol);
    var docParts = symbol.getDocumentationComment(undefined);
    var modifiedFlag = !!symbol.valueDeclaration ? ts.getCombinedModifierFlags(symbol.valueDeclaration) : 0;
    var isPublic = (modifiedFlag & ts.ModifierFlags.Public) !== 0;
    var res = {
        name: symbol.getName(),
        documentation: !!docParts ? ts.displayPartsToString(docParts) : "",
        type: checker.typeToString(type),
        isPublic: isPublic
    };
    if (state_1.stringLiteralTypes[res.type]) {
        res.type = state_1.stringLiteralTypes[res.type];
    }
    if (!!type.symbol && !!type.symbol.valueDeclaration && type.symbol.valueDeclaration.kind === ts.SyntaxKind.FunctionExpression) {
        var signature = checker.getSignatureFromDeclaration(type.symbol.valueDeclaration);
        var funDetails = serializeSignature(ctx, signature);
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
exports.serializeSymbol = serializeSymbol;
/** Serialize a class symbol information */
function serializeClass(ctx, symbol, node) {
    var details = serializeSymbol(ctx, symbol);
    details.implements = getImplementedTypes(ctx, node, details.name);
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
        details.entryType = types_1.DocEntryType.interfaceType;
    }
    if (node.kind !== ts.SyntaxKind.ClassDeclaration)
        return details;
    // Get the construct signatures
    var constructorType = ctx.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    details.entryType = types_1.DocEntryType.classType;
    details.constructors = getConstructors(ctx, constructorType);
    createPropertiesFromConstructors(details);
    var firstHeritageClauseType = getFirstHeritageClauseType(node);
    details.baseType = getBaseType(ctx, firstHeritageClauseType);
    return details;
}
exports.serializeClass = serializeClass;
function getConstructors(ctx, constructorType) {
    var res = [];
    var signitures = constructorType.getConstructSignatures();
    for (var i = 0; i < signitures.length; i++) {
        if (!signitures[i].declaration)
            continue;
        res.push(serializeSignature(ctx, signitures[i]));
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
function getImplementedTypes(ctx, node, className) {
    if (!node || !node.heritageClauses)
        return undefined;
    var clauses = node.heritageClauses;
    if (!Array.isArray(clauses) || clauses.length == 0)
        return undefined;
    var res = [];
    for (var i = 0; i < clauses.length; i++) {
        getImplementedTypesForClause(ctx, res, clauses[i], className);
    }
    return res;
}
function getImplementedTypesForClause(ctx, res, clause, className) {
    if (!clause || !Array.isArray(clause.types))
        return undefined;
    for (var i = 0; i < clause.types.length; i++) {
        var name_1 = getBaseType(ctx, clause.types[i]);
        if (!!name_1) {
            res.push(name_1);
        }
    }
}
function getBaseType(ctx, firstHeritageClauseType) {
    if (!firstHeritageClauseType)
        return "";
    var checker = ctx.checker;
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
        var name_2 = extendsType.symbol.name;
        if (!!expression.expression && expression.expression.escapedText)
            return expression.expression.escapedText + "." + name_2;
        return name_2;
    }
    if (!!expression.text)
        return expression.text;
    if (!!expression.expression && !!expression.expression.text && !!expression.name && !!expression.name.text)
        return expression.expression.text + "." + expression.name.text;
    return "";
}
exports.getBaseType = getBaseType;
function getTypedParameters(ctx, node, isArgument) {
    var params = getTypeParametersDeclaration(node, isArgument);
    if (!params || !Array.isArray(params))
        return undefined;
    var res = [];
    for (var i = 0; i < params.length; i++) {
        var name_3 = getTypeParameterName(ctx, params[i], isArgument);
        var extendsType = getTypeParameterConstrains(ctx, params[i]);
        res.push(name_3 + extendsType);
    }
    return res.length > 0 ? res : undefined;
}
function getTypeParameterName(ctx, node, isArgument) {
    var symbol = ctx.checker.getSymbolAtLocation(isArgument ? node.typeName : node.name);
    if (!!symbol && symbol.name)
        return symbol.name;
    return "any";
}
function getTypeParameterConstrains(ctx, node) {
    if (!node["default"])
        return "";
    var first = getTypeParameterName(ctx, node["default"], true);
    var second = !!node.constraint ? getTypeParameterName(ctx, node.constraint, true) : "";
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
function serializeMember(ctx, symbol, node) {
    var details = serializeSymbol(ctx, symbol);
    if (ast_utils_1.getPMEType(node.kind) !== "property") {
        setupMethodInfo(ctx, details, symbol, node);
    }
    else {
        details.isLocalizable = getIsPropertyLocalizable(ctx, node);
        if (details.isLocalizable) {
            details.hasSet = true;
        }
    }
    return details;
}
exports.serializeMember = serializeMember;
/** Serialize a method symbol infomration */
function serializeMethod(ctx, symbol, node) {
    var details = serializeSymbol(ctx, symbol);
    setupMethodInfo(ctx, details, symbol, node);
    return details;
}
exports.serializeMethod = serializeMethod;
function setupMethodInfo(ctx, entry, symbol, node) {
    var signature = ctx.checker.getSignatureFromDeclaration(node);
    var funDetails = serializeSignature(ctx, signature);
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
    if (!Array.isArray(node.decorators))
        return false;
    var checker = ctx.checker;
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
                var name_4 = props[k]["name"];
                if (!name_4)
                    continue;
                var symName = checker.getSymbolAtLocation(name_4);
                if (!!symName && symName.name === "localizable")
                    return true;
            }
        }
    }
    return false;
}
/** Serialize a signature (call or construct) */
function serializeSignature(ctx, signature) {
    var checker = ctx.checker;
    var params = signature.parameters;
    var res = {
        parameters: params.map(function (param) { return serializeSymbol(ctx, param); }),
        returnType: getReturnType(ctx, signature),
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
exports.serializeSignature = serializeSignature;
function addNestedParameters(ctx, parameters, node) {
    var checker = ctx.checker;
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
function getReturnType(ctx, signature) {
    var res = ctx.checker.typeToString(signature.getReturnType());
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
