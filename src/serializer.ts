import * as ts from "typescript";
import { GenerationContext } from "./context";
import { DocEntry, DocEntryType } from "./types";
import { stringLiteralTypes } from "./state";
import { getPMEType } from "./ast-utils";

function getTypeOfSymbol(ctx: GenerationContext, symbol: ts.Symbol): ts.Type {
  if (symbol.valueDeclaration)
    return ctx.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
  return ctx.checker.getDeclaredTypeOfSymbol(symbol);
}
export function updateEventOptionInterfaceName(ctx: GenerationContext, node: ts.Node, ser: DocEntry): void {
  const typeObj: any = ctx.checker.getTypeAtLocation(node);
  if(!typeObj) return;
  const args = typeObj.typeArguments;
  if(!Array.isArray(args) || args.length < 2) return;
  ser.eventSenderName = getSymbolName(args[args.length - 2].symbol);
  ser.eventOptionsName = getSymbolName(args[args.length - 1].symbol);
}
function getSymbolName(symbol: any): string {
  return !!symbol && !!symbol.name ? symbol.name : "";
}
/** Serialize a symbol into a json object */

export function serializeSymbol(ctx: GenerationContext, symbol: ts.Symbol): DocEntry {
  const checker = ctx.checker;
  const type = getTypeOfSymbol(ctx, symbol);
  const docParts = symbol.getDocumentationComment(undefined);
  const modifiedFlag = !!symbol.valueDeclaration ? ts.getCombinedModifierFlags(symbol.valueDeclaration) : 0;
  const isPublic = (modifiedFlag & ts.ModifierFlags.Public) !== 0;
  const res: any = {
    name: symbol.getName(),
    documentation: !!docParts ? ts.displayPartsToString(docParts) : "",
    type: checker.typeToString(type),
    isPublic: isPublic
  };
  if(stringLiteralTypes[res.type]) {
    res.type = stringLiteralTypes[res.type];
  }
  if(!!type.symbol && !!type.symbol.valueDeclaration && type.symbol.valueDeclaration.kind === ts.SyntaxKind.FunctionExpression) {
    const signature = checker.getSignatureFromDeclaration(<ts.SignatureDeclaration>type.symbol.valueDeclaration);
    const funDetails = serializeSignature(ctx, signature);
    if(funDetails && Array.isArray(funDetails.parameters)) {
        res.parameters = funDetails.parameters
    }
}
  var jsTags = symbol.getJsDocTags();
  if (jsTags) {
    var seeArray = [];
    for (var i = 0; i < jsTags.length; i++) {
      if (jsTags[i].name == "title") {
        res["metaTitle"] = jsTags[i].text;
      }
      if (jsTags[i].name == "description") {
        res["metaDescription"] = jsTags[i].text;
      }
      if (jsTags[i].name == "deprecated") {
        res.isDeprecated = true;
        let text = jsTags[i].text;
        if(!!text) {
          text = text.trim();
          if(text) {
            text = "Obsolete. " + text;
          }
        }
        if(!!text) {
          res.deprecationInfo = text;
        }
      }
      if (jsTags[i].name == "see") {
        seeArray.push(jsTags[i].text);
      }
      if (jsTags[i].name == "returns") {
        res["returnDocumentation"] = jsTags[i].text;
      }
      if (jsTags[i].name == "hidden") {
        res.isHidden = true;
      }
      if (jsTags[i].name == "hidefor") {
        const hideFor = jsTags[i].text;
        if(!!hideFor) {
          const hideForVal = hideFor.split(",").map((item: string) => item.trim());
          if(hideForVal.length > 0) {
            res["hideForClasses"] = hideForVal;
          }
        }
      }
    }
    if (seeArray.length > 0) {
      res["see"] = seeArray;
    }
  }
  return res;
}

/** Serialize a class symbol information */
export function serializeClass(ctx: GenerationContext, symbol: ts.Symbol, node: ts.Node) {
  let details = serializeSymbol(ctx, symbol);
  details.implements = getImplementedTypes(ctx, node, details.name);
  if(node.kind === ts.SyntaxKind.InterfaceDeclaration) {
    details.entryType = DocEntryType.interfaceType;
  }
  if (node.kind !== ts.SyntaxKind.ClassDeclaration) return details;
  // Get the construct signatures
  let constructorType = ctx.checker.getTypeOfSymbolAtLocation(
    symbol,
    symbol.valueDeclaration
  );
  details.entryType = DocEntryType.classType;
  details.constructors = getConstructors(ctx, constructorType);
  createPropertiesFromConstructors(details);
  const firstHeritageClauseType = getFirstHeritageClauseType(<ts.ClassDeclaration>node);
  details.baseType = getBaseType(ctx, firstHeritageClauseType);
  return details;
}
function getConstructors(ctx: GenerationContext, constructorType: ts.Type): DocEntry[] {
  const res = [];
  const signitures = constructorType.getConstructSignatures();
  for(var i = 0; i < signitures.length; i ++) {
    if(!signitures[i].declaration) continue;
    res.push(serializeSignature(ctx, signitures[i]));
  }
  return res;
}
function createPropertiesFromConstructors(entry: DocEntry) {
  if(!Array.isArray(entry.constructors)) return;
  for(var i = 0; i < entry.constructors.length; i ++) {
    createPropertiesFromConstructor(entry, entry.constructors[i]);
  }
}
function createPropertiesFromConstructor(classEntry: DocEntry, entry: DocEntry) {
  if(!Array.isArray(entry.parameters)) return;
  for(var i = 0; i < entry.parameters.length; i ++) {
    const param = entry.parameters[i];
    if(!param.isPublic) continue;
    if(!classEntry.members) classEntry.members = [];
    classEntry.members.push(
      { name: param.name, pmeType: "property", isField: true, isPublic: true, type: param.type}
  );
  }
}
function getHeritageClause(node: ts.ClassDeclaration, index: number): ts.HeritageClause {
  if (!node || !node.heritageClauses || node.heritageClauses.length <= index) return undefined;
  return node.heritageClauses[index];
}
function getFirstHeritageClauseType(node: ts.ClassDeclaration): ts.ExpressionWithTypeArguments {
  const clause = getHeritageClause(node, 0);
  return !!clause ? clause.types[0] : undefined;
}
function getImplementedTypes(ctx: GenerationContext, node: ts.Node, className: string): string[] {
  if(!node || !(<ts.ClassDeclaration>node).heritageClauses) return undefined;
  const clauses = (<ts.ClassDeclaration>node).heritageClauses;
  if(!Array.isArray(clauses) || clauses.length == 0) return undefined;
  const res = [];
  for(var i = 0; i < clauses.length; i ++) {
    getImplementedTypesForClause(ctx, res, clauses[i], className);
  }
  return res;
}
function getImplementedTypesForClause(ctx: GenerationContext, res: string[], clause: ts.HeritageClause, className: string) {
  if(!clause || !Array.isArray(clause.types)) return undefined;
  for(var i = 0;  i < clause.types.length; i ++) {
    const name = getBaseType(ctx, clause.types[i]);
    if(!!name) {
      res.push(name);
    }
  }
}
export function getBaseType(ctx: GenerationContext, firstHeritageClauseType: ts.ExpressionWithTypeArguments): string {
  if(!firstHeritageClauseType) return "";
  const checker = ctx.checker;
  const expression: any = firstHeritageClauseType.expression;
  // Handle mixin pattern: extends mixinFunction(BaseClass)
  if(expression.kind === ts.SyntaxKind.CallExpression && expression.arguments && expression.arguments.length > 0) {
    const arg = expression.arguments[0];
    const argType = checker.getTypeAtLocation(arg);
    if(argType && argType.symbol) {
      return argType.symbol.name;
    }
    if(arg.escapedText) return arg.escapedText;
    if(arg.text) return arg.text;
    return "";
  }
  const extendsType = checker.getTypeAtLocation(
    firstHeritageClauseType.expression
  );
  if (extendsType && extendsType.symbol) {
    const name = extendsType.symbol.name;
    if(!!expression.expression && expression.expression.escapedText)
      return expression.expression.escapedText + "." + name;
    return name;
  }
  if(!!expression.text) return expression.text;
  if(!!expression.expression && !!expression.expression.text && !!expression.name && !!expression.name.text)
    return expression.expression.text + "." + expression.name.text;
  return "";
}
function getTypedParameters(ctx: GenerationContext, node: ts.Node, isArgument: boolean): string[] {
  const params = getTypeParametersDeclaration(node, isArgument);
  if(!params || !Array.isArray(params)) return undefined;
  const res = [];
  for(var i = 0; i < params.length; i ++) {
    const name = getTypeParameterName(ctx, params[i], isArgument);
    const extendsType = getTypeParameterConstrains(ctx, params[i]);
    res.push(name + extendsType);
  }
  return res.length > 0 ? res : undefined;
}
function getTypeParameterName(ctx: GenerationContext, node: any, isArgument: boolean): string {
  let symbol = ctx.checker.getSymbolAtLocation(isArgument? (<any>node).typeName : node.name);
  if (!!symbol && symbol.name) return symbol.name;
  return "any";
}
function getTypeParameterConstrains(ctx: GenerationContext, node: any): string {
  if(!node.default) return "";
  const first = getTypeParameterName(ctx, node.default, true);
  const second =  !!node.constraint ? getTypeParameterName(ctx, node.constraint, true) : "";
  if(!first) return "";
  if(!!second) return " extends " + first + " = " + second;
  return " = " + first;
}
function getTypeParametersDeclaration(node: any, isArgument: boolean): Array<ts.TypeParameterDeclaration> {
  if(!node) return undefined;
  if(!isArgument && !!node.typeParameters) return node.typeParameters;
  if(isArgument && !!node.typeArguments) return node.typeArguments;
  if(isArgument && !!node.elementType) return [<ts.TypeParameterDeclaration>node.elementType];
  return undefined;
}
export function serializeMember(ctx: GenerationContext, symbol: ts.Symbol, node: ts.Node) {
  const details = serializeSymbol(ctx, symbol);
  if (getPMEType(node.kind) !== "property") {
    setupMethodInfo(ctx, details, symbol, node);
  } else {
    details.isLocalizable = getIsPropertyLocalizable(ctx, node);
    if(details.isLocalizable) {
      details.hasSet = true;
    }
  }
  return details;
}
/** Serialize a method symbol infomration */
export function serializeMethod(ctx: GenerationContext, symbol: ts.Symbol, node: ts.Node) {
  const details = serializeSymbol(ctx, symbol);
  setupMethodInfo(ctx, details, symbol, node);
  return details;
}
function setupMethodInfo(ctx: GenerationContext, entry: DocEntry, symbol: ts.Symbol, node: ts.Node) {
  let signature = ctx.checker.getSignatureFromDeclaration(
    <ts.SignatureDeclaration>node
  );
  const funDetails = serializeSignature(ctx, signature);
  entry.parameters = funDetails.parameters;
  if (entry.parameters && entry.parameters.length > 0) {
    addNestedParameters(ctx, entry.parameters, node);
  }
  entry.returnType = funDetails.returnType;
  entry.typeGenerics = getTypedParameters(ctx, node, false);
  entry.returnTypeGenerics = getTypedParameters(ctx, (<ts.SignatureDeclaration>node).type, true);
  if(entry.returnType === "Array" && !entry.returnTypeGenerics) {
    entry.returnTypeGenerics = ["any"];
  }
}
function getIsPropertyLocalizable(ctx: GenerationContext, node: ts.Node): boolean {
  if(!Array.isArray(node.decorators)) return false;
  const checker = ctx.checker;
  for(var i = 0; i < node.decorators.length; i ++) {
    const decor = node.decorators[i];
    const expression = decor.expression["expression"];
    const decor_arguments: ts.Node[] = decor.expression["arguments"];
    if(!expression || !Array.isArray(decor_arguments)) continue;
    const sym = checker.getSymbolAtLocation(expression);
    if(!sym || sym.name !== "property") continue;
    for(var j = 0; j < decor_arguments.length; j ++) {
      const arg = decor_arguments[j];
      const props: ts.Node[] = arg["properties"];
      if(!Array.isArray(props)) continue;
      for(var k = 0; k < props.length; k ++) {
        const name: ts.Node = props[k]["name"];
        if(!name) continue;
        const symName = checker.getSymbolAtLocation(name);
        if(!!symName && symName.name === "localizable") return true;
      }
    }
  }
  return false;
}
/** Serialize a signature (call or construct) */
export function serializeSignature(ctx: GenerationContext, signature: ts.Signature) {
  const checker = ctx.checker;
  const params = signature.parameters;
  const res = {
    parameters: params.map((param: ts.Symbol) => serializeSymbol(ctx, param)),
    returnType: getReturnType(ctx, signature),
    documentation: ts.displayPartsToString(
      signature.getDocumentationComment(undefined)
    ),
  };
  for(var i = 0; i < params.length; i ++) {
    const node: any = params[i].valueDeclaration;
    if(!!node) {
      res.parameters[i].isOptional = checker.isOptionalParameter(node);
    }
  }
  return res;
}
function addNestedParameters(ctx: GenerationContext, parameters: DocEntry[], node: any) {
  const checker = ctx.checker;
  if (node.jsDoc && node.jsDoc.length > 0) {
    const jsDoc = node.jsDoc[0];
    if (jsDoc.tags) {
      jsDoc.tags.forEach((tag: any) => {
        if (tag.tagName.text === "param" && tag.typeExpression && tag.name && tag.name.left && tag.name.right) {
          const paramName = tag.name.left.text;
          const nextedParam = tag.name.right.text;
          const paramType = checker.getTypeAtLocation(tag.typeExpression.type);
          parameters.push({ name: paramName + "." + nextedParam, type: checker.typeToString(paramType), documentation: tag.comment });
        }
      });
    }
  }
}
function getReturnType(ctx: GenerationContext, signature: ts.Signature): string {
  var res = ctx.checker.typeToString(signature.getReturnType());
  if(res === "{}") res = "any";
  if(res !== "any") return res;
  const type = signature.declaration.type;
  if(!type) return res;
  if(type.kind === ts.SyntaxKind.ArrayType) return "Array";
  if(!type["typeName"]) return res;
  const name = type["typeName"].text;
  return !!name ? name : res;
}
