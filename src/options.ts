import * as ts from "typescript";

const tsDefaultOptions: ts.CompilerOptions = {
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
export function getTsOptions(options: ts.CompilerOptions): ts.CompilerOptions {
  const res: ts.CompilerOptions = {};
  for(key in tsDefaultOptions) res[key] = tsDefaultOptions[key];
  for(var key in options) res[key] = options[key];
  return res;
}
