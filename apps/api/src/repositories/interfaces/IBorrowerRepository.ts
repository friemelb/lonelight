import { BorrowerRecord } from '@loanlens/domain';
import { FindOptions } from './IDocumentRepository';

export interface IBorrowerRepository {
  // Create
  create(borrower: BorrowerRecord): Promise<void>;

  // Read
  findById(id: string): Promise<BorrowerRecord | null>;
  findAll(options?: FindOptions): Promise<BorrowerRecord[]>;
  search(query: string): Promise<BorrowerRecord[]>;
  count(): Promise<number>;

  // Update
  update(id: string, borrower: BorrowerRecord): Promise<void>;

  // Delete
  delete(id: string): Promise<void>;
}
