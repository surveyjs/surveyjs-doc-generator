var doc = require("./index.js");
var ts = require("typescript");

/* //Creator
doc.generateDocumentation(["src/entries/index.ts"], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
*/
var Survey = require("../survey-library/packages/survey-core/build/survey.core");

doc.setJsonObj(Survey.Serializer);
doc.generateDocumentation(["entries/chunks/model.ts"], {
    target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
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
