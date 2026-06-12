import * as ts from "typescript";
import { GenerationContext } from "./context";
import { DocEntry, DocEntryType } from "./types";
import { jsonObjMetaData, stringLiteralTypes } from "./state";
import {
  hasMembers, getJsonTypeName, isSurveyEventType, getPMEType,
  isNodeExported, isPMENodeExported, isSymbolHasComments, isOptionsInterface
} from "./ast-utils";
import { serializeSymbol, serializeClass, serializeMember, updateEventOptionInterfaceName } from "./serializer";

/** visit nodes finding exported classes */
export function visit(ctx: GenerationContext, node: ts.Node) {
  const checker = ctx.checker;
  // Only consider exported nodes
  if (!isNodeExported(node)) return;
  if (node.kind === ts.SyntaxKind.VariableStatement) {
    const vsNode = <ts.VariableStatement>node;
    if(vsNode.declarationList.declarations.length > 0) {
      const varNode = vsNode.declarationList.declarations[0];
      let symbol = checker.getSymbolAtLocation(
        (<ts.VariableDeclaration>varNode).name
      );
      if (!!symbol && isSymbolHasComments(symbol)) {
        visitVariableNode(ctx, varNode, symbol);
      }
    }
  } else if (node.kind === ts.SyntaxKind.ClassDeclaration) {
    // This is a top level class, get its symbol
    let symbol = checker.getSymbolAtLocation(
      (<ts.ClassDeclaration>node).name
    );
    if(!symbol) return;
    if (isSymbolHasComments(symbol)) {
      visitDocumentedNode(ctx, node, symbol);
    }
  } else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
    // This is a top level class, get its symbol
    const name = (<ts.InterfaceDeclaration>node).name;
    let symbol = checker.getSymbolAtLocation(name);
    if (isSymbolHasComments(symbol) || isOptionsInterface(name.text)) {
      visitDocumentedNode(ctx, node, symbol);
    }
  } else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
    // This is a namespace, visit its children
    ts.forEachChild(node, (child: ts.Node) => visit(ctx, child));
  } else if(node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
    visitExportTypeAliasNode(ctx, <ts.TypeAliasDeclaration>node);
  }
}
function visitExportTypeAliasNode(ctx: GenerationContext, node: ts.TypeAliasDeclaration) {
  const checker = ctx.checker;
  const type = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(node.name));
  const types = (<any>type).types;
  if(Array.isArray(types) && types.length > 0) {
    const literals = [];
    for(let i = 0; i < types.length; i ++) {
      if(typeof types[i].value === "string") {
        literals.push("\"" + types[i].value + "\"");
      }
    }
    if(types.length === literals.length) {
      stringLiteralTypes[node.name.text] = literals.join(" | ");
    }
  }
}
function visitVariableNode(ctx: GenerationContext, node: ts.VariableDeclaration, symbol: ts.Symbol) {
  const entry = serializeSymbol(ctx, symbol);
  entry.entryType = DocEntryType.variableType;
  visitVariableProperties(ctx, entry, node);
  entry.allTypes = [entry.name];
  entry.isPublic = true;
  ctx.outputClasses.push(entry);
  entry.members = [];
}
function visitVariableProperties(ctx: GenerationContext, entry: DocEntry, node: ts.VariableDeclaration) {
  if(!node.initializer) return;
  const children = (<any>node.initializer).properties;
  if(!Array.isArray(children)) return;
  for(var i = 0; i < children.length; i ++) {
    visitVariableMember(ctx, entry, children[i]);
  }
}
function visitVariableMember(ctx: GenerationContext, entry: DocEntry, node: ts.Node) {
  let symbol = ctx.checker.getSymbolAtLocation(
    (<ts.ClassDeclaration>node).name
  );
  const memberEntry = serializeClass(ctx, symbol, node);
  if(memberEntry) {
    if(!entry.members) entry.members = [];
    entry.members.push(memberEntry);
    if(entry.entryType === DocEntryType.variableType) {
        ctx.outputPMEs.push(memberEntry);
        memberEntry.className = entry.name;
        memberEntry.pmeType = "property";
        memberEntry.isPublic = true;
        memberEntry.isField = true,
        memberEntry.hasSet = true;
    }
    visitVariableProperties(ctx, memberEntry, <ts.VariableDeclaration>node);
  }
}
function visitDocumentedNode(ctx: GenerationContext, node: ts.Node, symbol: ts.Symbol) {
  ctx.curClass = serializeClass(ctx, symbol, node);
  ctx.classesHash[ctx.curClass.name] = ctx.curClass;
  let isOptions = ctx.curClass.name.indexOf("IOn") === 0;
  if(!isOptions) {
    ctx.outputClasses.push(ctx.curClass);
  }
  ctx.curJsonName = null;
  ts.forEachChild(node, (child: ts.Node) => visitClassNode(ctx, child));
  if(isOptions) return;
  if (!ctx.curJsonName) return;
  ctx.curClass.jsonName = ctx.curJsonName;
  if (!jsonObjMetaData) return;
  const curJsonName = ctx.curJsonName;
  const curClass = ctx.curClass;
  const properties = jsonObjMetaData.getProperties(curJsonName);
  const classInfo = jsonObjMetaData.findClass(curJsonName);
  const hiddenProps = {};
  const parentHiddenClasses = [];
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    if (prop.visible === false && !!classInfo.parentName) {
      let parentClassInfo = jsonObjMetaData.findClass(classInfo.parentName);
      let parentProp = jsonObjMetaData.findProperty(parentClassInfo.name, prop.name);
      while (parentClassInfo && parentClassInfo.parentName && !!parentProp && parentProp === prop) {
        parentClassInfo = jsonObjMetaData.findClass(parentClassInfo.parentName);
        parentProp = jsonObjMetaData.findProperty(parentClassInfo.name, prop.name);
      }
      if (parentProp && parentProp.visible !== false) {
        parentClassInfo = jsonObjMetaData.findClass(parentClassInfo.name);
        while (parentClassInfo && parentClassInfo.parentName && !!jsonObjMetaData.findProperty(parentClassInfo.parentName, prop.name)) {
          parentClassInfo = jsonObjMetaData.findClass(parentClassInfo.parentName);
        }
        if (parentHiddenClasses.indexOf(parentClassInfo.name) < 0) {
          parentHiddenClasses.push(parentClassInfo.name);
        }
        hiddenProps[prop.name] = parentClassInfo.name;
      }
    }
  }
  for (let i = 0; i < ctx.outputPMEs.length; i++) {
    const pme = ctx.outputPMEs[i];
    if (pme.pmeType !== "property") continue;
    if (parentHiddenClasses.length > 0 && ctx.classesHash[pme.className]) {
      const pmeJsonName = pme.jsonName || ctx.classesHash[pme.className].jsonName;
      if (parentHiddenClasses.indexOf(pmeJsonName) > -1) {
        if (hiddenProps[pme.name] === pmeJsonName) {
          if (!Array.isArray(pme.hideForClasses)) {
            pme.hideForClasses = [];
          }
          pme.hideForClasses.push(curClass.name);
        }
      }
    }
    if (pme.className == curClass.name) {
      const prop = jsonObjMetaData.findProperty(curJsonName, pme.name);
      if (!!prop) {
        pme.isSerialized = prop.isSerializable !== false;
        if (prop.defaultValue) {
          pme.defaultValue = prop.defaultValue;
        }
        if (prop.choices) {
          pme.serializedChoices = prop.choices;
        }
        if (prop.className) {
          pme.jsonClassName = prop.className;
        }
      }
    }
  }
}
function visitClassNode(ctx: GenerationContext, node: ts.Node) {
  const checker = ctx.checker;
  var symbol = null;
  if (node.kind === ts.SyntaxKind.MethodDeclaration)
    symbol = checker.getSymbolAtLocation((<ts.MethodDeclaration>node).name);
  if (node.kind === ts.SyntaxKind.FunctionDeclaration)
    symbol = checker.getSymbolAtLocation((<ts.FunctionDeclaration>node).name);
  if (node.kind === ts.SyntaxKind.PropertyDeclaration)
    symbol = checker.getSymbolAtLocation((<ts.PropertyDeclaration>node).name);
  if (node.kind === ts.SyntaxKind.GetAccessor)
    symbol = checker.getSymbolAtLocation(
      (<ts.GetAccessorDeclaration>node).name
    );
  if (node.kind === ts.SyntaxKind.SetAccessor)
    symbol = checker.getSymbolAtLocation(
      (<ts.SetAccessorDeclaration>node).name
    );
  if (node.kind === ts.SyntaxKind.PropertySignature)
    symbol = checker.getSymbolAtLocation((<ts.PropertySignature>node).name);
  if (node.kind === ts.SyntaxKind.MethodSignature)
    symbol = checker.getSymbolAtLocation((<ts.MethodSignature>node).name);
  if(!symbol) return;
  if (!isPMENodeExported(node, symbol)) return;
  var ser = serializeMember(ctx, symbol, node);
  let fullName = ser.name;
  if (ctx.curClass) {
    ser.className = ctx.curClass.name;
    ser.jsonName = ctx.curClass.jsonName;
    fullName = ctx.curClass.name + "." + fullName;
    if(!ctx.curClass.members) ctx.curClass.members = [];
    if (!hasMembers(ctx.curClass, ser.name)) {
      ctx.curClass.members.push(ser);
    }
  }
  ser.pmeType = getPMEType(node.kind);
  const modifier = ts.getCombinedModifierFlags(<ts.Declaration>node);
  if ((modifier & ts.ModifierFlags.Static) !== 0) {
    ser.isStatic = true;
  }
  if ((modifier & ts.ModifierFlags.Protected) !== 0) {
    ser.isProtected = true;
  }
  if(node.kind === ts.SyntaxKind.PropertyDeclaration
    && !ser.isLocalizable
    && ser.isField === undefined) {
    ser.isField = true;
  }
  if(node.kind === ts.SyntaxKind.PropertySignature) {
    ser.isField = true;
    ser.isOptional = checker.isOptionalParameter(<any>node);
  }
  if (isSurveyEventType(ser.type)) {
    ser.pmeType = "event";
    updateEventOptionInterfaceName(ctx, node, ser);
    //if (!ser.documentation && (ser.eventSenderName === "__type" || !ser.eventOptionsName)) {
    //Remove any event if there is no documentation
    if (!ser.documentation) {
      ser = null;
    }
  }
  if (ser && node.kind === ts.SyntaxKind.GetAccessor) {
    ser.isField = false;
    let serSet = ctx.pmesHash[fullName];
    if (serSet) {
      ser.hasSet = serSet.hasSet;
    } else ser.hasSet = false;
  }
  if (node.kind === ts.SyntaxKind.SetAccessor) {
    let serGet = ctx.pmesHash[fullName];
    if (serGet) {
        serGet.hasSet = true;
        ser.isField = false;
    }
    ser = null;
  }
  if (ser) {
    if (!ser.parameters) ser.parameters = [];
    ctx.pmesHash[fullName] = ser;
    ctx.outputPMEs.push(ser);
  }
  if (ser && ser.name === "getType") {
    ctx.curJsonName = getJsonTypeName(<ts.FunctionDeclaration>node);
  }
}
