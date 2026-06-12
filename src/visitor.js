"use strict";
exports.__esModule = true;
exports.visit = void 0;
var ts = require("typescript");
var types_1 = require("./types");
var state_1 = require("./state");
var ast_utils_1 = require("./ast-utils");
var serializer_1 = require("./serializer");
/** visit nodes finding exported classes */
function visit(ctx, node) {
    var checker = ctx.checker;
    // Only consider exported nodes
    if (!ast_utils_1.isNodeExported(node))
        return;
    if (node.kind === ts.SyntaxKind.VariableStatement) {
        var vsNode = node;
        if (vsNode.declarationList.declarations.length > 0) {
            var varNode = vsNode.declarationList.declarations[0];
            var symbol = checker.getSymbolAtLocation(varNode.name);
            if (!!symbol && ast_utils_1.isSymbolHasComments(symbol)) {
                visitVariableNode(ctx, varNode, symbol);
            }
        }
    }
    else if (node.kind === ts.SyntaxKind.ClassDeclaration) {
        // This is a top level class, get its symbol
        var symbol = checker.getSymbolAtLocation(node.name);
        if (!symbol)
            return;
        if (ast_utils_1.isSymbolHasComments(symbol)) {
            visitDocumentedNode(ctx, node, symbol);
        }
    }
    else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
        // This is a top level class, get its symbol
        var name_1 = node.name;
        var symbol = checker.getSymbolAtLocation(name_1);
        if (ast_utils_1.isSymbolHasComments(symbol) || ast_utils_1.isOptionsInterface(name_1.text)) {
            visitDocumentedNode(ctx, node, symbol);
        }
    }
    else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
        // This is a namespace, visit its children
        ts.forEachChild(node, function (child) { return visit(ctx, child); });
    }
    else if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
        visitExportTypeAliasNode(ctx, node);
    }
}
exports.visit = visit;
function visitExportTypeAliasNode(ctx, node) {
    var checker = ctx.checker;
    var type = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(node.name));
    var types = type.types;
    if (Array.isArray(types) && types.length > 0) {
        var literals = [];
        for (var i = 0; i < types.length; i++) {
            if (typeof types[i].value === "string") {
                literals.push("\"" + types[i].value + "\"");
            }
        }
        if (types.length === literals.length) {
            state_1.stringLiteralTypes[node.name.text] = literals.join(" | ");
        }
    }
}
function visitVariableNode(ctx, node, symbol) {
    var entry = serializer_1.serializeSymbol(ctx, symbol);
    entry.entryType = types_1.DocEntryType.variableType;
    visitVariableProperties(ctx, entry, node);
    entry.allTypes = [entry.name];
    entry.isPublic = true;
    ctx.outputClasses.push(entry);
    entry.members = [];
}
function visitVariableProperties(ctx, entry, node) {
    if (!node.initializer)
        return;
    var children = node.initializer.properties;
    if (!Array.isArray(children))
        return;
    for (var i = 0; i < children.length; i++) {
        visitVariableMember(ctx, entry, children[i]);
    }
}
function visitVariableMember(ctx, entry, node) {
    var symbol = ctx.checker.getSymbolAtLocation(node.name);
    var memberEntry = serializer_1.serializeClass(ctx, symbol, node);
    if (memberEntry) {
        if (!entry.members)
            entry.members = [];
        entry.members.push(memberEntry);
        if (entry.entryType === types_1.DocEntryType.variableType) {
            ctx.outputPMEs.push(memberEntry);
            memberEntry.className = entry.name;
            memberEntry.pmeType = "property";
            memberEntry.isPublic = true;
            memberEntry.isField = true,
                memberEntry.hasSet = true;
        }
        visitVariableProperties(ctx, memberEntry, node);
    }
}
function visitDocumentedNode(ctx, node, symbol) {
    ctx.curClass = serializer_1.serializeClass(ctx, symbol, node);
    ctx.classesHash[ctx.curClass.name] = ctx.curClass;
    var isOptions = ctx.curClass.name.indexOf("IOn") === 0;
    if (!isOptions) {
        ctx.outputClasses.push(ctx.curClass);
    }
    ctx.curJsonName = null;
    ts.forEachChild(node, function (child) { return visitClassNode(ctx, child); });
    if (isOptions)
        return;
    if (!ctx.curJsonName)
        return;
    ctx.curClass.jsonName = ctx.curJsonName;
    if (!state_1.jsonObjMetaData)
        return;
    var curJsonName = ctx.curJsonName;
    var curClass = ctx.curClass;
    var properties = state_1.jsonObjMetaData.getProperties(curJsonName);
    var classInfo = state_1.jsonObjMetaData.findClass(curJsonName);
    var hiddenProps = {};
    var parentHiddenClasses = [];
    for (var i = 0; i < properties.length; i++) {
        var prop = properties[i];
        if (prop.visible === false && !!classInfo.parentName) {
            var parentClassInfo = state_1.jsonObjMetaData.findClass(classInfo.parentName);
            var parentProp = state_1.jsonObjMetaData.findProperty(parentClassInfo.name, prop.name);
            while (parentClassInfo && parentClassInfo.parentName && !!parentProp && parentProp === prop) {
                parentClassInfo = state_1.jsonObjMetaData.findClass(parentClassInfo.parentName);
                parentProp = state_1.jsonObjMetaData.findProperty(parentClassInfo.name, prop.name);
            }
            if (parentProp && parentProp.visible !== false) {
                parentClassInfo = state_1.jsonObjMetaData.findClass(parentClassInfo.name);
                while (parentClassInfo && parentClassInfo.parentName && !!state_1.jsonObjMetaData.findProperty(parentClassInfo.parentName, prop.name)) {
                    parentClassInfo = state_1.jsonObjMetaData.findClass(parentClassInfo.parentName);
                }
                if (parentHiddenClasses.indexOf(parentClassInfo.name) < 0) {
                    parentHiddenClasses.push(parentClassInfo.name);
                }
                hiddenProps[prop.name] = parentClassInfo.name;
            }
        }
    }
    for (var i = 0; i < ctx.outputPMEs.length; i++) {
        var pme = ctx.outputPMEs[i];
        if (pme.pmeType !== "property")
            continue;
        if (parentHiddenClasses.length > 0 && ctx.classesHash[pme.className]) {
            var pmeJsonName = pme.jsonName || ctx.classesHash[pme.className].jsonName;
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
            var prop = state_1.jsonObjMetaData.findProperty(curJsonName, pme.name);
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
    var checker = ctx.checker;
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
    if (!ast_utils_1.isPMENodeExported(node, symbol))
        return;
    var ser = serializer_1.serializeMember(ctx, symbol, node);
    var fullName = ser.name;
    if (ctx.curClass) {
        ser.className = ctx.curClass.name;
        ser.jsonName = ctx.curClass.jsonName;
        fullName = ctx.curClass.name + "." + fullName;
        if (!ctx.curClass.members)
            ctx.curClass.members = [];
        if (!ast_utils_1.hasMembers(ctx.curClass, ser.name)) {
            ctx.curClass.members.push(ser);
        }
    }
    ser.pmeType = ast_utils_1.getPMEType(node.kind);
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
    if (ast_utils_1.isSurveyEventType(ser.type)) {
        ser.pmeType = "event";
        serializer_1.updateEventOptionInterfaceName(ctx, node, ser);
        //if (!ser.documentation && (ser.eventSenderName === "__type" || !ser.eventOptionsName)) {
        //Remove any event if there is no documentation
        if (!ser.documentation) {
            ser = null;
        }
    }
    if (ser && node.kind === ts.SyntaxKind.GetAccessor) {
        ser.isField = false;
        var serSet = ctx.pmesHash[fullName];
        if (serSet) {
            ser.hasSet = serSet.hasSet;
        }
        else
            ser.hasSet = false;
    }
    if (node.kind === ts.SyntaxKind.SetAccessor) {
        var serGet = ctx.pmesHash[fullName];
        if (serGet) {
            serGet.hasSet = true;
            ser.isField = false;
        }
        ser = null;
    }
    if (ser) {
        if (!ser.parameters)
            ser.parameters = [];
        ctx.pmesHash[fullName] = ser;
        ctx.outputPMEs.push(ser);
    }
    if (ser && ser.name === "getType") {
        ctx.curJsonName = ast_utils_1.getJsonTypeName(node);
    }
}
