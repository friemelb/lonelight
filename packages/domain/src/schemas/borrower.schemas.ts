import { z } from 'zod';
import {
  ExtractedFieldSchema,
  StringExtractedFieldSchema,
  NumberExtractedFieldSchema,
  BooleanExtractedFieldSchema
} from './common.schemas';
import { IncomeHistoryItemSchema } from './income.schemas';

/**
 * Zod schema for ExtractedAddress
 */
export const ExtractedAddressSchema = z.object({
  street: StringExtractedFieldSchema,
  city: StringExtractedFieldSchema,
  state: StringExtractedFieldSchema,
  zipCode: StringExtractedFieldSchema,
  country: StringExtractedFieldSchema.optional()
});

/**
 * Zod schema for BorrowerRecord
 */
export const BorrowerRecordSchema = z.object({
  id: z.string().uuid('Borrower ID must be a valid UUID'),
  fullName: StringExtractedFieldSchema,
  firstName: StringExtractedFieldSchema.optional(),
  middleName: StringExtractedFieldSchema.optional(),
  lastName: StringExtractedFieldSchema.optional(),
  ssn: StringExtractedFieldSchema.optional(),
  dateOfBirth: StringExtractedFieldSchema.optional(),
  phoneNumber: StringExtractedFieldSchema.optional(),
  alternatePhoneNumber: StringExtractedFieldSchema.optional(),
  email: StringExtractedFieldSchema.optional(),
  currentAddress: ExtractedAddressSchema.optional(),
  previousAddresses: z.array(ExtractedAddressSchema).optional(),
  incomeHistory: ExtractedFieldSchema(z.array(IncomeHistoryItemSchema)).optional(),
  accountNumbers: z.array(StringExtractedFieldSchema).optional(),
  loanNumbers: z.array(StringExtractedFieldSchema).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  documentIds: z.array(z.string().uuid()).min(1, 'At least one document ID is required')
});
