import { GenerationContext } from "./context";
import { DocEntry } from "./types";

export function addClassIntoJSONDefinition(
  ctx: GenerationContext,
  className: string,
  isRoot: boolean = false
) {
  if (className == "IElement") {
    className = "SurveyElement";
  }
  if (!!ctx.generateJSONDefinitionClasses[className]) return;
  ctx.generateJSONDefinitionClasses[className] = true;
  var cur = ctx.classesHash[className];
  if (!isRoot && (!cur || !hasSerializedProperties(ctx, className))) {
    addChildrenClasses(ctx, className);
    return;
  }
  if (!cur || (!isRoot && hasClassInJSONDefinition(ctx, className))) return;
  var root = ctx.outputDefinition;
  if (!isRoot) {
    if (!ctx.outputDefinition["definitions"]) {
      ctx.outputDefinition["definitions"] = {};
    }
    ctx.outputDefinition["definitions"][cur.jsonName] = {};
    root = ctx.outputDefinition["definitions"][cur.jsonName];
    root["$id"] = "#" + cur.jsonName;
  }
  root["type"] = "object";
  addPropertiesIntoJSONDefinion(ctx, cur, root);
  if (!isRoot) {
    addParentClass(ctx, cur, root);
    addChildrenClasses(ctx, cur.name);
  }
}
function addParentClass(ctx: GenerationContext, cur: DocEntry, root: any) {
  if (!cur.baseType) return;
  addClassIntoJSONDefinition(ctx, cur.baseType);
  var parentClass = ctx.classesHash[cur.baseType];
  if (!!parentClass && hasClassInJSONDefinition(ctx, parentClass.jsonName)) {
    var properties = root["properties"];
    delete root["properties"];
    root["allOff"] = [
      { $ref: "#" + parentClass.jsonName },
      { properties: properties },
    ];
  }
}
function addChildrenClasses(ctx: GenerationContext, className: string) {
  for (var i = 0; i < ctx.outputClasses.length; i++) {
    if (ctx.outputClasses[i].baseType == className) {
      addClassIntoJSONDefinition(ctx, ctx.outputClasses[i].name);
    }
  }
}

function hasClassInJSONDefinition(ctx: GenerationContext, className: string) {
  return (
    !!ctx.outputDefinition["definitions"] &&
    !!ctx.outputDefinition["definitions"][className]
  );
}
function addPropertiesIntoJSONDefinion(ctx: GenerationContext, cur: any, jsonDef: any) {
  for (var i = 0; i < ctx.outputPMEs.length; i++) {
    var property = ctx.outputPMEs[i];
    if (property.className !== cur.name || !property.isSerialized)
      continue;
    addPropertyIntoJSONDefinion(ctx, property, jsonDef);
  }
}
function hasSerializedProperties(ctx: GenerationContext, className: string): boolean {
  for (var i = 0; i < ctx.outputPMEs.length; i++) {
    var property = ctx.outputPMEs[i];
    if (property.className == className && property.isSerialized) return true;
  }
  return false;
}
function addPropertyIntoJSONDefinion(ctx: GenerationContext, property, jsonDef) {
  if (!jsonDef.properties) {
    jsonDef.properties = {};
  }
  var properties = jsonDef.properties;
  var typeName = property.type;
  var isArray = !!typeName && typeName.indexOf("[]") > -1;
  if (!!property.jsonClassName || isArray) {
    addClassIntoJSONDefinition(ctx, typeName.replace("[]", ""));
  }
  var typeInfo: any = getTypeValue(ctx, property);
  var propInfo: any = { type: typeInfo };
  if (isArray) {
    propInfo = { type: "array", items: typeInfo };
  }
  if (
    !!property.serializedChoices &&
    Array.isArray(property.serializedChoices) &&
    property.serializedChoices.length > 1
  ) {
    propInfo["enum"] = property.serializedChoices;
  }
  properties[property.name] = propInfo;
}
function getTypeValue(ctx: GenerationContext, property: DocEntry): any {
  var propType = property.type;
  if (propType.indexOf("|") > 0) return ["boolean", "string"];
  if (propType == "any") return ["string", "numeric", "boolean"];
  if (propType == "string" || propType == "numeric" || propType == "boolean")
    return propType;
  var childrenTypes = [];
  addChildrenTypes(ctx, propType.replace("[]", ""), childrenTypes);
  if (childrenTypes.length == 1) return getReferenceType(ctx, childrenTypes[0]);
  if (childrenTypes.length > 1) {
    var res = [];
    for (var i = 0; i < childrenTypes.length; i++) {
      res.push(getReferenceType(ctx, childrenTypes[i]));
    }
    return res;
  }
  return getReferenceType(ctx, propType.replace("[]", ""));
}
function addChildrenTypes(ctx: GenerationContext, type: string, childrenTypes: Array<string>) {
  if (type == "IElement") type = "SurveyElement";
  for (var i = 0; i < ctx.outputClasses.length; i++) {
    if (ctx.outputClasses[i].baseType == type) {
      var count = childrenTypes.length;
      addChildrenTypes(ctx, ctx.outputClasses[i].name, childrenTypes);
      if (count == childrenTypes.length) {
        childrenTypes.push(ctx.outputClasses[i].name);
      }
    }
  }
}
function getReferenceType(ctx: GenerationContext, type: string): any {
  var curClass = ctx.classesHash[type];
  if (!curClass) return type;
  return { $href: "#" + curClass.jsonName };
}
