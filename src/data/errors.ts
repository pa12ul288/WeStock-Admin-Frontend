export type DataErrorCode =
  'not_allowed' | 'reason_required' | 'not_found' | 'duplicate_tag' | 'validation' | 'network';

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly field: string | undefined;
  constructor(code: DataErrorCode, message?: string, field?: string) {
    super(message ?? code);
    this.name = 'DataError';
    this.code = code;
    this.field = field;
  }
}
