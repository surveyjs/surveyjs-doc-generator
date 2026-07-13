#!/usr/bin/env node
var path = require("path");
var doc = require("../index.js");
var ts = require("typescript");

function printUsage() {
  console.log(
    "Usage: surveyjs-doc-generator <entry.ts> [<entry.ts> ...] [options]\n" +
    "\n" +
    "Generates docs/classes.json and docs/pmes.json in the current working directory.\n" +
    "\n" +
    "Options:\n" +
    "  --serializer <module>   Module that exports 'Serializer' (a built library bundle,\n" +
    "                          e.g. ./build/survey.core, or a package name, e.g. survey-core).\n" +
    "                          Its metadata enriches the docs with serialization info.\n" +
    "  --json-definition       Also generate docs/surveyjs_definition.json.\n" +
    "  -h, --help              Show this help."
  );
}

var entries = [];
var serializerSpec = null;
var jsonDefinition = false;

var args = process.argv.slice(2);
for (var i = 0; i < args.length; i++) {
  var arg = args[i];
  if (arg === "--serializer") {
    serializerSpec = args[++i];
    if (!serializerSpec) {
      console.error("Error: --serializer requires a module path or package name.");
      process.exit(1);
    }
  } else if (arg === "--json-definition") {
    jsonDefinition = true;
  } else if (arg === "-h" || arg === "--help") {
    printUsage();
    process.exit(0);
  } else if (arg.charAt(0) === "-") {
    console.error("Error: unknown option '" + arg + "'.");
    printUsage();
    process.exit(1);
  } else {
    entries.push(arg);
  }
}

if (entries.length === 0) {
  console.error("Error: no entry files specified.");
  printUsage();
  process.exit(1);
}

if (serializerSpec) {
  var resolved = serializerSpec.charAt(0) === "." || path.isAbsolute(serializerSpec)
    ? path.resolve(process.cwd(), serializerSpec)
    : require.resolve(serializerSpec, { paths: [process.cwd()] });
  var serializerModule = require(resolved);
  if (!serializerModule.Serializer) {
    console.error("Error: module '" + serializerSpec + "' does not export 'Serializer'.");
    process.exit(1);
  }
  doc.setJsonObj(serializerModule.Serializer);
}

doc.generateDocumentation(entries, {
  target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
}, { generateJSONDefinition: jsonDefinition });
