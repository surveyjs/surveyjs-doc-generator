"use strict";
exports.__esModule = true;
exports.getAbsoluteFileName = exports.checkFiles = exports.printError = void 0;
var fs = require("fs");
var path = require("path");
function printError(text) {
    console.log(text);
}
exports.printError = printError;
function checkFiles(fileNames, errorText) {
    if (!Array.isArray(fileNames)) {
        printError("file list is empty");
        return false;
    }
    for (var i = 0; i < fileNames.length; i++) {
        var absFileName = getAbsoluteFileName(fileNames[i]);
        if (!fs.existsSync(absFileName)) {
            printError(errorText + ": " + absFileName);
            return false;
        }
    }
    return true;
}
exports.checkFiles = checkFiles;
function getAbsoluteFileName(name) {
    return path.join(process.cwd(), name);
}
exports.getAbsoluteFileName = getAbsoluteFileName;
