import { z } from 'zod';

/**
 * Helper function to validate data against a Zod schema
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns The validated and typed data
 * @throws ZodError if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Helper function to safely validate data against a Zod schema
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns A result object with success flag and either data or error
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
