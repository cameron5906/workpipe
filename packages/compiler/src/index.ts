import { VERSION as LANG_VERSION } from "@workpipe/lang";

export const VERSION = "0.0.1";
export { LANG_VERSION };

export * from "./ast/index.js";
export * from "./codegen/index.js";
export * from "./diagnostic/index.js";
export * from "./analysis/index.js";
export * from "./semantics/index.js";
export { format, type FormatOptions } from "./format/index.js";
export * from "./imports/index.js";

export {
  compile,
  compileWithImports,
  compileToYaml,
  createImportContext,
  type ImportContext,
  type CompileOptions,
} from "./compile.js";
