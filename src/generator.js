"use strict";
exports.__esModule = true;
exports.generateDocumentation = void 0;
var ts = require("typescript");
var fs = require("fs");
var options_1 = require("./options");
var file_utils_1 = require("./file-utils");
var vue_files_1 = require("./vue-files");
var inheritance_1 = require("./inheritance");
var visitor_1 = require("./visitor");
var event_docs_1 = require("./event-docs");
var json_definition_1 = require("./json-definition");
/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(fileNames, options, docOptions) {
    if (docOptions === void 0) { docOptions = {}; }
    var ctx = {
        checker: null,
        outputClasses: [],
        outputPMEs: [],
        pmesHash: {},
        classesHash: {},
        curClass: null,
        curJsonName: null,
        generateJSONDefinitionClasses: {},
        generateJSONDefinition: docOptions.generateJSONDefinition === true,
        outputDefinition: {},
        vueGeneratedFiles: []
    };
    vue_files_1.generateVueTSFiles(ctx, fileNames);
    var tsOptions = options_1.getTsOptions(options);
    if (!file_utils_1.checkFiles(fileNames, "File for compiling is not found"))
        return;
    var host = ts.createCompilerHost(tsOptions);
    // Build a program using the set of root file names in fileNames
    var program = ts.createProgram(fileNames, tsOptions, host);
    // Get the checker, we will use it to find more about classes
    ctx.checker = program.getTypeChecker();
    // Visit every sourceFile in the program
    for (var _i = 0, _a = program.getSourceFiles(); _i < _a.length; _i++) {
        var sourceFile = _a[_i];
        if (sourceFile.fileName.indexOf("node_modules") > 0)
            continue;
        if (vue_files_1.isNonEnglishLocalizationFile(sourceFile.fileName))
            continue;
        // Walk the tree to search for classes
        ts.forEachChild(sourceFile, function (node) { return visitor_1.visit(ctx, node); });
    }
    for (var i = 0; i < fileNames.length; i++) {
        var sourceFile = program.getSourceFile(fileNames[i]);
        if (!!sourceFile) {
            ts.forEachChild(sourceFile, function (node) { return visitor_1.visit(ctx, node); });
        }
    }
    for (var key in ctx.classesHash) {
        inheritance_1.setAllParentTypes(ctx, key);
    }
    event_docs_1.updateEventsDocumentation(ctx);
    event_docs_1.updateHiddenForEntriesDoc(ctx);
    // print out the doc
    fs.writeFileSync(process.cwd() + "/docs/classes.json", JSON.stringify(ctx.outputClasses, undefined, 4));
    fs.writeFileSync(process.cwd() + "/docs/pmes.json", JSON.stringify(ctx.outputPMEs, undefined, 4));
    if (ctx.generateJSONDefinition) {
        ctx.outputDefinition["$schema"] = "http://json-schema.org/draft-07/schema#";
        ctx.outputDefinition["title"] = "SurveyJS Library json schema";
        json_definition_1.addClassIntoJSONDefinition(ctx, "SurveyModel", true);
        fs.writeFileSync(process.cwd() + "/docs/surveyjs_definition.json", JSON.stringify(ctx.outputDefinition, undefined, 4));
    }
    vue_files_1.deleteVueTSFiles(ctx);
}
exports.generateDocumentation = generateDocumentation;
