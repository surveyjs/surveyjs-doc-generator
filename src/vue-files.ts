import * as fs from "fs";
import * as path from "path";
import { GenerationContext } from "./context";
import { getAbsoluteFileName } from "./file-utils";

export function generateVueTSFiles(ctx: GenerationContext, fileNames: string[]) {
  for(var i = 0; i < fileNames.length; i++) {
    const fn = fileNames[i];
    let text: string = fs.readFileSync(getAbsoluteFileName(fn), 'utf8');
    const dir = path.dirname(fn);
    generateVueTSFile(ctx, text, dir);
    const matchArray = text.match(/(?<=export \* from ")(.*)(?=";)/gm);
    if(!Array.isArray(matchArray)) continue;
    for (var i = 0; i < matchArray.length; i++) {
        const fnChild = path.join(dir, matchArray[i] + ".ts");
        const absFnChild = getAbsoluteFileName(fnChild);
        if(!fs.existsSync(absFnChild)) return;
        text = fs.readFileSync(absFnChild, 'utf8');
        generateVueTSFile(ctx, text, dir);
    }
  }
}
function generateVueTSFile(ctx: GenerationContext, text: string, dir: string) {
  const matchArray = text.match(/(?<=")(.*)(?=.vue";)/gm);
  if(!Array.isArray(matchArray)) return;
  for(var i = 0; i < matchArray.length; i ++) {
    const fileName = path.join(dir, matchArray[i] + ".vue");
    if(!fs.existsSync(fileName)) continue;
    let absFileName = getAbsoluteFileName(fileName);
    const vueText: string = fs.readFileSync(absFileName, 'utf8');
    const startStr = "<script lang=\"ts\">";
    const endStr = "</script>";
    const startIndex = vueText.indexOf(startStr) + startStr.length;
    const endIndex = vueText.lastIndexOf(endStr);
    if(endIndex > startIndex && startIndex > 0) {
      const vue_tsText = vueText.substring(startIndex, endIndex);
      absFileName += ".ts";
      ctx.vueGeneratedFiles.push(absFileName);
      fs.writeFileSync(absFileName, vue_tsText);
    }
  }
}
export function deleteVueTSFiles(ctx: GenerationContext) {
  for(var i = 0; i < ctx.vueGeneratedFiles.length; i ++) {
    fs.unlinkSync(ctx.vueGeneratedFiles[i]);
  }
}
export function isNonEnglishLocalizationFile(fileName: string): boolean {
  const dir = path.dirname(fileName);
  const name = path.basename(fileName);
  if(name === "english") return false;
  const loc = "localization";
  return dir.lastIndexOf(loc) > dir.length - loc.length - 3;
}
