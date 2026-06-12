import { GenerationContext } from "./context";
import { DocEntryType } from "./types";

/** set allParentTypes */
export function setAllParentTypes(ctx: GenerationContext, className: string) {
  if (!className) return;
  var cur = ctx.classesHash[className];
  if (cur.allTypes && cur.allTypes.length > 0) return;
  setAllParentTypesCore(ctx, cur);
}
function setAllParentTypesCore(ctx: GenerationContext, cur: any) {
  cur.allTypes = [];
  cur.allTypes.push(cur.name);
  if(cur.entryType === DocEntryType.interfaceType && Array.isArray(cur.implements)) {
    cur.implements.forEach(item => addBaseAllTypesIntoCur(ctx, cur, item));
  }
  if (!cur.baseType) return;
  addBaseAllTypesIntoCur(ctx, cur, cur.baseType);
}
function addBaseAllTypesIntoCur(ctx: GenerationContext, cur: any, className: string): void {
  if(!className) return;
  var baseClass = ctx.classesHash[className];
  if (!baseClass) return;
  if (!baseClass.allTypes) {
    setAllParentTypesCore(ctx, baseClass);
  }
  for (var i = 0; i < baseClass.allTypes.length; i++) {
    cur.allTypes.push(baseClass.allTypes[i]);
  }
}
