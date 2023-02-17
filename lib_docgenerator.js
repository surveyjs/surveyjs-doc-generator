var doc = require("./index.js");
var ts = require("typescript");

//doc.generateDocumentation(["src/entries/index.ts"], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });

var Survey = require("../survey-library/build/survey-knockout/survey.ko");

doc.setJsonObj(Survey.Serializer);

doc.generateDocumentation(["src/entries/chunks/model.ts"], {
    target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
});

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
//var Survey = require("../survey-library/build/survey-knockout/survey.ko");
//var SurveyCore = require("../survey-library/build/survey-core/survey-core");
//var SurveyReact = require("../survey-library/build/survey-react-ui/survey-react-ui");

//doc.setJsonObj(Survey.JsonObject.metaData);
/*
doc.generateDts({ 
  entries: ["./src/entries/knockout-ui.ts"],
  out: "./build/survey-knockout-ui/survey-knockout-ui.d.ts",
  name: "Type definition for Survey JavaScript library for Knockout (without core)",
  license: "MIT (http://www.opensource.org/licenses/mit-license.php)",
  excludeImports: true,
  paths: {
    "survey-core": ["./build/survey-core/survey.core.d.ts"],
  }    
})
*/
/*
doc.generateDts({ 
  entries: ["../survey-creator-core/src/entries/index.ts", "./src/entries/index.ts"],
  out: "./build/survey-creator-knockout.d.ts",
  name: "Type definition for Survey Creator library for Knockout",
  license: "https://surveyjs.io/Licenses#SurveyCreator",
  paths: {
    "survey-core": ["./node_modules/survey-core/survey.core.d.ts"],
    "survey-knockout-ui": ["./node_modules/survey-knockout-ui/survey-knockout-ui.d.ts"]
  }    
}
);
*/
/*
doc.generateDts({ 
  entries: ["./src/entries/index.ts"],
  out: "./build/survey-creator-react.d.ts",
  name: "Type definition for Survey Creator library for React",
  license: "https://surveyjs.io/Licenses#SurveyCreator",
  paths: {
    "survey-core": ["./node_modules/survey-core/survey.core.d.ts"],
    "survey-react-ui": ["./node_modules/survey-react-ui/survey-react-ui.d.ts"]
  }    
}
);
*/
/*
doc.generateDts({ 
  entries: ["./src/entries/angular.ts"],
  out: "./build/survey-angular/survey.angular.d.ts",
  name: "Type definition for Survey JavaScript library for Angular",
  license: "MIT (http://www.opensource.org/licenses/mit-license.php)"
}
);
*/
/*
doc.generateDts(
  ["./src/entries/react-ui.ts"],
  { 
    dtsOutput: "./build/survey-react-ui/survey-react-ui.d.ts", 
    paths: {
      "survey-core": ["./build/survey-core/survey.core.d.ts"],
    }    
  }
)
*/
/*
doc.generateDocumentation(
  //["./src/entries/chunks/model.ts"],
  //["./src/entries/react-ui.ts"],
  //["./src/entries/index.ts"],
  ["./src/entries/angular.ts"],
  {

  },
  { 
    generateDoc: false, 
    generateJSONDefinition: false, 
    //dtsFileName: "./survey.core.d.ts", 
    //dtsFileName: "./survey-react-ui.d.ts", 
    dtsFileName: "./survey.angular.d.ts", 
    dtsImports: [
      //{ name: "survey-core", file: "./survey.core.d.ts" }
      //{name: "survey-core", file:"../../../survey-library/survey-core.d.ts"},
      //{name: "survey-react-ui", file:"../../../survey-library/survey-react-ui.d.ts"}
    ]
  }
);
*/