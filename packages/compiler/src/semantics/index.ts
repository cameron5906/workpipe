export { validateCycleTermination } from "./cycle-validation.js";
export { validateRequiredFields } from "./required-fields.js";
export { validateOutputs } from "./output-validation.js";
export { validateSchemas } from "./schema-validation.js";
export { validateMatrixJobs, calculateMatrixJobCount } from "./matrix-validation.js";
export { validateExpressionTypes } from "./expression-type-validation.js";
export {
  inferExpressionType,
  checkExpressionTypes,
  checkComparisonTypes,
  checkNumericOperation,
  checkPropertyAccess,
  isNumericType,
  areTypesCompatible,
  type TypeContext,
  type InferredType,
} from "./expression-types.js";
export { extractInterpolations, type ParsedInterpolation } from "./expression-parser.js";
export {
  createTypeRegistry,
  buildTypeRegistry,
  validateTypeReferences,
  type TypeRegistry,
} from "./type-registry.js";
