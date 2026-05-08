import { IncomeHistoryItem } from './income.types';

/**
 * An individual extracted data point with full source traceability
 */
export interface ExtractedField<T = string> {
  /** The extracted value */
  value: T;

  /** Confidence score from extraction process (0-1) */
  confidence: number;

  /** ID of the source document this field was extracted from */
  sourceDocumentId: string;

  /** Page number in the source document (1-indexed) */
  sourcePage: number;

  /** Direct text quote from the document supporting this extraction */
  evidenceQuote: string;

  /** Optional bounding box coordinates [x, y, width, height] */
  boundingBox?: [number, number, number, number];

  /** When this field was extracted */
  extractedAt?: Date;

  /** Optional notes or context about the extraction */
  notes?: string;
}

/**
 * Address information with source traceability
 */
export interface ExtractedAddress {
  street: ExtractedField<string>;
  city: ExtractedField<string>;
  state: ExtractedField<string>;
  zipCode: ExtractedField<string>;
  country?: ExtractedField<string>;
}

/**
 * Aggregated borrower information extracted from multiple documents
 */
export interface BorrowerRecord {
  /** Unique identifier for the borrower */
  id: string;

  /** Full legal name */
  fullName: ExtractedField<string>;

  /** First name */
  firstName?: ExtractedField<string>;

  /** Middle name or initial */
  middleName?: ExtractedField<string>;

  /** Last name */
  lastName?: ExtractedField<string>;

  /** Social Security Number (encrypted in storage) */
  ssn?: ExtractedField<string>;

  /** Date of birth */
  dateOfBirth?: ExtractedField<string>;

  /** Primary phone number */
  phoneNumber?: ExtractedField<string>;

  /** Secondary phone number */
  alternatePhoneNumber?: ExtractedField<string>;

  /** Email address */
  email?: ExtractedField<string>;

  /** Current residential address */
  currentAddress?: ExtractedAddress;

  /** Previous addresses */
  previousAddresses?: ExtractedAddress[];

  /** Employment and income history */
  incomeHistory?: ExtractedField<IncomeHistoryItem[]>;

  /** Bank account numbers */
  accountNumbers?: ExtractedField<string>[];

  /** Loan numbers */
  loanNumbers?: ExtractedField<string>[];

  /** When this borrower record was created */
  createdAt: Date;

  /** When this borrower record was last updated */
  updatedAt: Date;

  /** IDs of all documents associated with this borrower */
  documentIds: string[];
}
