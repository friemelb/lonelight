import { ExtractedField } from './borrower.types';

/**
 * Type of income source
 */
export enum IncomeType {
  SALARY = 'SALARY',
  HOURLY = 'HOURLY',
  COMMISSION = 'COMMISSION',
  BONUS = 'BONUS',
  SELF_EMPLOYMENT = 'SELF_EMPLOYMENT',
  RENTAL = 'RENTAL',
  INVESTMENT = 'INVESTMENT',
  SOCIAL_SECURITY = 'SOCIAL_SECURITY',
  PENSION = 'PENSION',
  OTHER = 'OTHER'
}

/**
 * Frequency of income payment
 */
export enum IncomeFrequency {
  HOURLY = 'HOURLY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  SEMI_MONTHLY = 'SEMI_MONTHLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
  ONE_TIME = 'ONE_TIME'
}

/**
 * A record of income from a specific source and time period
 */
export interface IncomeHistoryItem {
  /** Employer or income source name */
  employer: ExtractedField<string>;

  /** Job title or position */
  jobTitle?: ExtractedField<string>;

  /** Type of income */
  incomeType: ExtractedField<IncomeType>;

  /** Payment frequency */
  frequency: ExtractedField<IncomeFrequency>;

  /** Gross income amount */
  grossAmount: ExtractedField<number>;

  /** Net income amount (after taxes and deductions) */
  netAmount?: ExtractedField<number>;

  /** Start date of employment or income period */
  startDate: ExtractedField<string>;

  /** End date if no longer current */
  endDate?: ExtractedField<string>;

  /** Whether this is current/active income */
  isCurrent: ExtractedField<boolean>;

  /** Year to date earnings (if available) */
  ytdEarnings?: ExtractedField<number>;

  /** Tax year this income applies to */
  taxYear?: ExtractedField<number>;
}
