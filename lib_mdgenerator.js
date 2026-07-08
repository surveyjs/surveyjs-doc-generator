var doc = require("./index.js");
var ts = require("typescript");
var path = require("path");

// The entry paths ("entries/chunks/model.ts") and the docs/ output are resolved
// against the current working directory, so run everything from the survey-core
// package regardless of where node is launched from.
process.chdir(path.join(__dirname, "../survey-library/packages/survey-core"));

/* //Creator
doc.generateDocumentation(["src/entries/index.ts"], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
*/
var Survey = require("../survey-library/packages/survey-core/build/survey.core");

doc.setJsonObj(Survey.Serializer);
doc.generateDocumentation(["entries/chunks/model.ts"], {
    target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
}, {
    generateMDFiles: true
});
/*
doc.generateDocumentation(["src/index.ts"], {
  target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
});
*/
/*
doc.generateDocumentation(["src/entries/pdf.ts"], {
  target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
});
*/
/*
doc.generateDocumentation(["src/entries/index.ts"], {
  target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
});
*/
