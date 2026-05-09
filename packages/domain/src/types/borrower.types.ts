import { IncomeHistoryItem } from './income.types';

/**
 * Review status for borrower records
 */
export enum ReviewStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CORRECTED = 'corrected'
}

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

  /** Review status of this borrower record */
  reviewStatus: ReviewStatus;

  /** When this borrower was reviewed (if applicable) */
  reviewedAt?: Date;

  /** Notes from the reviewer */
  reviewerNotes?: string;
}

/**
 * A historical correction made to an extracted field by a human reviewer
 */
export interface FieldCorrection {
  /** Unique identifier for this correction */
  id: string;

  /** ID of the borrower this correction belongs to */
  borrowerId: string;

  /** Name of the field that was corrected */
  fieldName: string;

  /** Original AI-extracted value */
  originalValue: string;

  /** Human-corrected value */
  correctedValue: string;

  /** Confidence score of the original extraction */
  originalConfidence: number;

  /** Source document ID for the original extraction */
  sourceDocumentId: string;

  /** Source page number for the original extraction */
  sourcePage: number;

  /** Original evidence quote */
  originalEvidence: string;

  /** Note explaining why the correction was made */
  correctionNote?: string;

  /** When this correction was made */
  correctedAt: Date;
}

/**
 * Audit log entry for a review action
 */
export interface ReviewAction {
  /** Unique identifier for this action */
  id: string;

  /** ID of the borrower this action was performed on */
  borrowerId: string;

  /** Type of action performed */
  action: 'approved' | 'rejected' | 'corrected' | 'submitted_for_review';

  /** Previous status before this action */
  previousStatus: ReviewStatus;

  /** New status after this action */
  newStatus: ReviewStatus;

  /** Notes or comments for this action */
  notes?: string;

  /** When this action occurred */
  actionAt: Date;
}
