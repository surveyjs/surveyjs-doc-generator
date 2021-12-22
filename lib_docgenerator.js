var doc = require("./index.js");
var ts = require("typescript");
//var Survey = require("../survey-library/build/survey-knockout/survey.ko");
//var SurveyCore = require("../survey-library/build/survey-core/survey-core");
//var SurveyReact = require("../survey-library/build/survey-react-ui/survey-react-ui");

//doc.setJsonObj(Survey.JsonObject.metaData);

doc.generateDocumentation(
  //["./src/entries/chunks/model.ts"],
  ["./src/entries/react-ui.ts"],
  {
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS,
    "target": "es5",
    "module": "es2015",
    "lib": ["DOM", "ES5", "ES6", "ES2015.Promise"],
    "noImplicitAny": true,
    "importHelpers": false,
    "experimentalDecorators": true,
    //"moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "jsx": "react",
  },
  { 
    generateDoc: false, 
    generateJSONDefinition: false, 
    //dtsFileName: "./survey-core.d.ts", 
    dtsFileName: "./survey-react-ui.d.ts", 
    dtsImports: [
      { name: "survey-core", file: "./survey-core.d.ts" }
    ]
  }
);
