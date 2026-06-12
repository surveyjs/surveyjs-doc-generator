"use strict";
exports.__esModule = true;
exports.isOptionsInterface = exports.isSymbolHasComments = exports.isPMENodeExported = exports.isNodeExported = exports.getPMEType = exports.isSurveyEventType = exports.getJsonTypeName = exports.hasMembers = void 0;
var ts = require("typescript");
function hasMembers(entry, name) {
    if (!entry || !Array.isArray(entry.members))
        return false;
    for (var i = 0; i < entry.members.length; i++) {
        if (entry.members[i].name === name)
            return true;
    }
    return false;
}
exports.hasMembers = hasMembers;
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
exports.getJsonTypeName = getJsonTypeName;
function isSurveyEventType(type) {
    return !!type && (type.indexOf("Event") === 0 || type.indexOf("CreatorEvent") === 0);
}
exports.isSurveyEventType = isSurveyEventType;
function getPMEType(nodeKind) {
    if (nodeKind === ts.SyntaxKind.MethodDeclaration || nodeKind === ts.SyntaxKind.MethodSignature)
        return "method";
    if (nodeKind === ts.SyntaxKind.FunctionDeclaration)
        return "function";
    return "property";
}
exports.getPMEType = getPMEType;
/** True if this is visible outside this file, false otherwise */
function isNodeExported(node) {
    return ((node.flags & ts.NodeFlags["Export"]) !== 0 ||
        (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile));
}
exports.isNodeExported = isNodeExported;
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
exports.isPMENodeExported = isPMENodeExported;
/** True if there is a comment before declaration */
function isSymbolHasComments(symbol) {
    var com = symbol.getDocumentationComment(undefined);
    return com && com.length > 0;
}
exports.isSymbolHasComments = isSymbolHasComments;
function isOptionsInterface(name) {
    return name.indexOf("Options") > -1 || name.indexOf("Event") > -1;
}
exports.isOptionsInterface = isOptionsInterface;
