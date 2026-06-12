"use strict";
exports.__esModule = true;
exports.getTsOptions = void 0;
var ts = require("typescript");
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
exports.getTsOptions = getTsOptions;
