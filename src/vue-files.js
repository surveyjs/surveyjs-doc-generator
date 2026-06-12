"use strict";
exports.__esModule = true;
exports.isNonEnglishLocalizationFile = exports.deleteVueTSFiles = exports.generateVueTSFiles = void 0;
var fs = require("fs");
var path = require("path");
var file_utils_1 = require("./file-utils");
function generateVueTSFiles(ctx, fileNames) {
    for (var i = 0; i < fileNames.length; i++) {
        var fn = fileNames[i];
        var text = fs.readFileSync(file_utils_1.getAbsoluteFileName(fn), 'utf8');
        var dir = path.dirname(fn);
        generateVueTSFile(ctx, text, dir);
        var matchArray = text.match(/(?<=export \* from ")(.*)(?=";)/gm);
        if (!Array.isArray(matchArray))
            continue;
        for (var i = 0; i < matchArray.length; i++) {
            var fnChild = path.join(dir, matchArray[i] + ".ts");
            var absFnChild = file_utils_1.getAbsoluteFileName(fnChild);
            if (!fs.existsSync(absFnChild))
                return;
            text = fs.readFileSync(absFnChild, 'utf8');
            generateVueTSFile(ctx, text, dir);
        }
    }
}
exports.generateVueTSFiles = generateVueTSFiles;
function generateVueTSFile(ctx, text, dir) {
    var matchArray = text.match(/(?<=")(.*)(?=.vue";)/gm);
    if (!Array.isArray(matchArray))
        return;
    for (var i = 0; i < matchArray.length; i++) {
        var fileName = path.join(dir, matchArray[i] + ".vue");
        if (!fs.existsSync(fileName))
            continue;
        var absFileName = file_utils_1.getAbsoluteFileName(fileName);
        var vueText = fs.readFileSync(absFileName, 'utf8');
        var startStr = "<script lang=\"ts\">";
        var endStr = "</script>";
        var startIndex = vueText.indexOf(startStr) + startStr.length;
        var endIndex = vueText.lastIndexOf(endStr);
        if (endIndex > startIndex && startIndex > 0) {
            var vue_tsText = vueText.substring(startIndex, endIndex);
            absFileName += ".ts";
            ctx.vueGeneratedFiles.push(absFileName);
            fs.writeFileSync(absFileName, vue_tsText);
        }
    }
}
function deleteVueTSFiles(ctx) {
    for (var i = 0; i < ctx.vueGeneratedFiles.length; i++) {
        fs.unlinkSync(ctx.vueGeneratedFiles[i]);
    }
}
exports.deleteVueTSFiles = deleteVueTSFiles;
function isNonEnglishLocalizationFile(fileName) {
    var dir = path.dirname(fileName);
    var name = path.basename(fileName);
    if (name === "english")
        return false;
    var loc = "localization";
    return dir.lastIndexOf(loc) > dir.length - loc.length - 3;
}
exports.isNonEnglishLocalizationFile = isNonEnglishLocalizationFile;
