"use strict";
exports.__esModule = true;
exports.updateHiddenForEntriesDoc = exports.updateEventsDocumentation = void 0;
var constants_1 = require("./constants");
function updateEventsDocumentation(ctx) {
    for (var i = 0; i < ctx.outputPMEs.length; i++) {
        var ser = ctx.outputPMEs[i];
        if (!ser.eventSenderName || !ser.eventOptionsName || ser.eventOptionsName === "__type")
            continue;
        if (!ser.documentation)
            ser.documentation = "";
        if (ser.documentation.indexOf("- `sender`:") > -1)
            continue;
        var lines = [];
        lines.push("");
        lines.push("Parameters:");
        lines.push("");
        updateEventDocumentationSender(ser, lines);
        updateEventDocumentationOptions(ctx, ser, lines);
        var replacedTextIndex = ser.documentation.indexOf(constants_1.EventDescriptReplacedText);
        if (replacedTextIndex > -1) {
            ser.documentation = ser.documentation.replace(constants_1.EventDescriptReplacedText, lines.join("\n"));
        }
        else {
            lines.unshift("");
            ser.documentation += lines.join("\n");
        }
    }
}
exports.updateEventsDocumentation = updateEventsDocumentation;
function updateHiddenForEntriesDoc(ctx) {
    var addedEntries = [];
    var _loop_1 = function (i) {
        var ser = ctx.outputPMEs[i];
        if (Array.isArray(ser.hideForClasses)) {
            ser.hideForClasses.forEach(function (className) {
                hideEntryForClass(ctx, ser, className, addedEntries);
            });
        }
        if (ser.isHidden === true && !!ser.className) {
            ctx.outputClasses.forEach(function (cls) {
                if (cls.name !== ser.className && Array.isArray(cls.allTypes)
                    && cls.allTypes.indexOf(ser.className) > -1) {
                    hideEntryForClass(ctx, ser, cls.name, addedEntries);
                }
            });
        }
    };
    for (var i = 0; i < ctx.outputPMEs.length; i++) {
        _loop_1(i);
    }
    addedEntries.forEach(function (entry) {
        ctx.outputPMEs.push(entry);
    });
}
exports.updateHiddenForEntriesDoc = updateHiddenForEntriesDoc;
function hideEntryForClass(ctx, ser, className, addedEntries) {
    var classEntry = ctx.classesHash[className];
    if (!classEntry)
        return;
    if (!Array.isArray(classEntry.members)) {
        classEntry.members = [];
    }
    var entry = classEntry.members.find(function (item) { return item.name === ser.name; });
    if (!entry) {
        entry = JSON.parse(JSON.stringify(ser));
        classEntry.members.push(entry);
        addedEntries.push(entry);
    }
    entry.className = className;
    entry.isHidden = true;
    entry.documentation = "";
}
function updateEventDocumentationSender(ser, lines) {
    if (!ser.eventSenderName)
        return;
    var desc = "";
    if (ser.eventSenderName === "SurveyModel") {
        desc = constants_1.SurveyModelSenderDescription;
    }
    if (ser.eventSenderName.indexOf("Creator") > -1) {
        desc = constants_1.CreatorModelSenderDescription;
    }
    lines.push(" - `sender`: `" + ser.eventSenderName + "`" + (!!desc ? "  " : ""));
    if (!!desc) {
        lines.push(desc);
    }
}
function updateEventDocumentationOptions(ctx, ser, lines) {
    if (!ser.eventOptionsName)
        return;
    var members = {};
    fillEventMembers(ctx, ser.eventOptionsName, members);
    for (var key in members) {
        var m = members[key];
        var doc = m.documentation;
        if (m.isHidden === true || isHiddenEntryByDoc(doc))
            continue;
        lines.push("- `options." + m.name + "`: `" + m.type + "`" + (!!doc ? "  " : ""));
        if (!!doc) {
            lines.push(doc);
        }
    }
    ;
}
function isHiddenEntryByDoc(doc) {
    if (!doc)
        return true;
    doc = doc.toLocaleLowerCase();
    return doc.startsWith("obsolete") || doc.startsWith("for internal use");
}
function fillEventMembers(ctx, interfaceName, members) {
    var classEntry = ctx.classesHash[interfaceName];
    if (!classEntry)
        return;
    if (Array.isArray(classEntry.implements)) {
        for (var i = 0; i < classEntry.implements.length; i++) {
            fillEventMembers(ctx, classEntry.implements[i], members);
        }
    }
    if (!Array.isArray(classEntry.members))
        return;
    for (var i = 0; i < classEntry.members.length; i++) {
        var m = classEntry.members[i];
        members[m.name] = m;
    }
}
