import { z } from 'zod';
import { ProcessingStatus } from '../types/status.types';

/**
 * Zod schema for ProcessingStatus enum
 */
export const ProcessingStatusSchema = z.nativeEnum(ProcessingStatus);
