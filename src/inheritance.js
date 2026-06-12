"use strict";
exports.__esModule = true;
exports.setAllParentTypes = void 0;
var types_1 = require("./types");
/** set allParentTypes */
function setAllParentTypes(ctx, className) {
    if (!className)
        return;
    var cur = ctx.classesHash[className];
    if (cur.allTypes && cur.allTypes.length > 0)
        return;
    setAllParentTypesCore(ctx, cur);
}
exports.setAllParentTypes = setAllParentTypes;
function setAllParentTypesCore(ctx, cur) {
    cur.allTypes = [];
    cur.allTypes.push(cur.name);
    if (cur.entryType === types_1.DocEntryType.interfaceType && Array.isArray(cur.implements)) {
        cur.implements.forEach(function (item) { return addBaseAllTypesIntoCur(ctx, cur, item); });
    }
    if (!cur.baseType)
        return;
    addBaseAllTypesIntoCur(ctx, cur, cur.baseType);
}
function addBaseAllTypesIntoCur(ctx, cur, className) {
    if (!className)
        return;
    var baseClass = ctx.classesHash[className];
    if (!baseClass)
        return;
    if (!baseClass.allTypes) {
        setAllParentTypesCore(ctx, baseClass);
    }
    for (var i = 0; i < baseClass.allTypes.length; i++) {
        cur.allTypes.push(baseClass.allTypes[i]);
    }
}
