/**
 * JSON Schema to Zod converter
 * Converts JSON Schema objects to Zod validation schemas
 */

import { z } from 'zod/v4';

/**
 * Convert a JSON Schema to a Zod schema
 */
export function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  // Handle empty or null schema
  if (!schema || Object.keys(schema).length === 0) {
    return z.object({});
  }

  // Handle $ref (not fully supported, treat as any)
  if (schema.$ref) {
    console.warn('[Schema Converter] $ref is not fully supported:', schema.$ref);
    return z.any();
  }

  // Handle anyOf, oneOf, allOf
  if (schema.anyOf || schema.oneOf) {
    const schemas = schema.anyOf || schema.oneOf;
    if (schemas.length === 0) return z.any();
    return z.union(schemas.map(jsonSchemaToZod) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  if (schema.allOf) {
    // Merge all schemas (simplified - just return the first for now)
    return jsonSchemaToZod(schema.allOf[0] || {});
  }

  // Handle type-specific schemas
  switch (schema.type) {
    case 'string':
      return convertStringSchema(schema);
    case 'number':
    case 'integer':
      return convertNumberSchema(schema);
    case 'boolean':
      return z.boolean();
    case 'array':
      return convertArraySchema(schema);
    case 'object':
      return convertObjectSchema(schema);
    case 'null':
      return z.null();
    default:
      // No type specified - try to infer
      if (schema.properties) return convertObjectSchema(schema);
      if (schema.items) return convertArraySchema(schema);
      if (schema.enum) return convertStringSchema(schema);
      return z.any();
  }
}

/**
 * Convert string schema
 */
function convertStringSchema(schema: any): z.ZodTypeAny {
  // Handle enum first
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return z.enum(schema.enum as [string, ...string[]]);
  }

  let zodSchema: z.ZodString = z.string();

  // String constraints
  if (schema.minLength !== undefined) {
    zodSchema = zodSchema.min(schema.minLength);
  }
  if (schema.maxLength !== undefined) {
    zodSchema = zodSchema.max(schema.maxLength);
  }
  if (schema.pattern) {
    try {
      zodSchema = zodSchema.regex(new RegExp(schema.pattern));
    } catch (err) {
      console.warn('[Schema Converter] Invalid regex pattern:', schema.pattern);
    }
  }
  if (schema.format === 'email') {
    zodSchema = zodSchema.email();
  }
  if (schema.format === 'url' || schema.format === 'uri') {
    zodSchema = zodSchema.url();
  }
  if (schema.format === 'uuid') {
    zodSchema = zodSchema.uuid();
  }

  return zodSchema;
}

/**
 * Convert number schema
 */
function convertNumberSchema(schema: any): z.ZodNumber {
  let zodSchema: z.ZodNumber = z.number();

  // Integer constraint
  if (schema.type === 'integer') {
    zodSchema = zodSchema.int();
  }

  // Number constraints
  if (schema.minimum !== undefined) {
    zodSchema = zodSchema.min(schema.minimum);
  }
  if (schema.maximum !== undefined) {
    zodSchema = zodSchema.max(schema.maximum);
  }
  if (schema.exclusiveMinimum !== undefined) {
    zodSchema = zodSchema.gt(schema.exclusiveMinimum);
  }
  if (schema.exclusiveMaximum !== undefined) {
    zodSchema = zodSchema.lt(schema.exclusiveMaximum);
  }
  if (schema.multipleOf !== undefined) {
    zodSchema = zodSchema.multipleOf(schema.multipleOf);
  }

  return zodSchema;
}

/**
 * Convert array schema
 */
function convertArraySchema(schema: any): z.ZodArray<any> {
  const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any();
  let zodSchema = z.array(itemSchema);

  // Array constraints
  if (schema.minItems !== undefined) {
    zodSchema = zodSchema.min(schema.minItems);
  }
  if (schema.maxItems !== undefined) {
    zodSchema = zodSchema.max(schema.maxItems);
  }

  return zodSchema;
}

/**
 * Convert object schema
 */
function convertObjectSchema(schema: any): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const [key, propSchema] of Object.entries(properties)) {
    let zodProp = jsonSchemaToZod(propSchema);

    // Handle required/optional
    const isRequired = required.includes(key);
    if (!isRequired) {
      zodProp = zodProp.optional();
    }

    // Handle default value
    if ((propSchema as any).default !== undefined) {
      zodProp = zodProp.default((propSchema as any).default);
    }

    // Handle description
    if ((propSchema as any).description) {
      zodProp = zodProp.describe((propSchema as any).description);
    }

    shape[key] = zodProp;
  }

  return z.object(shape);
}

/**
 * Validate that a schema can be converted (for testing/debugging)
 */
export function validateJsonSchema(schema: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    jsonSchemaToZod(schema);
    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(String(error));
    return { valid: false, errors };
  }
}
