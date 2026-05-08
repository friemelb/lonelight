import { z } from 'zod';
import {
  ExtractedFieldSchema,
  StringExtractedFieldSchema,
  NumberExtractedFieldSchema,
  BooleanExtractedFieldSchema
} from './common.schemas';

/**
 * Zod schema for IncomeType enum
 */
export const IncomeTypeSchema = z.enum([
  'SALARY',
  'HOURLY',
  'COMMISSION',
  'BONUS',
  'SELF_EMPLOYMENT',
  'RENTAL',
  'INVESTMENT',
  'SOCIAL_SECURITY',
  'PENSION',
  'OTHER'
]);

/**
 * Zod schema for IncomeFrequency enum
 */
export const IncomeFrequencySchema = z.enum([
  'HOURLY',
  'WEEKLY',
  'BIWEEKLY',
  'SEMI_MONTHLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUALLY',
  'ONE_TIME'
]);

/**
 * Zod schema for IncomeHistoryItem
 */
export const IncomeHistoryItemSchema = z.object({
  employer: StringExtractedFieldSchema,
  jobTitle: StringExtractedFieldSchema.optional(),
  incomeType: ExtractedFieldSchema(IncomeTypeSchema),
  frequency: ExtractedFieldSchema(IncomeFrequencySchema),
  grossAmount: NumberExtractedFieldSchema,
  netAmount: NumberExtractedFieldSchema.optional(),
  startDate: StringExtractedFieldSchema,
  endDate: StringExtractedFieldSchema.optional(),
  isCurrent: BooleanExtractedFieldSchema,
  ytdEarnings: NumberExtractedFieldSchema.optional(),
  taxYear: NumberExtractedFieldSchema.optional()
});
