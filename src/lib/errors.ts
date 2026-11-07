import { DataError, type DataErrorCode } from '../data/errors';

/** The messages from docs/data-contract.md. `validation` errors normally carry their own. */
export const ERROR_MESSAGES: Record<DataErrorCode, string> = {
  not_allowed: "Your role can't make this change.",
  reason_required: 'Add a reason for the fix.',
  not_found: 'This record no longer exists. The list has been refreshed.',
  duplicate_tag: 'Tag {tag} is already used on this farm.',
  validation: 'Check this field and try again.',
  network: "Couldn't save. Check your connection and try again.",
};

/**
 * The message to show the user for any thrown error. `validation` and `duplicate_tag` errors carry
 * their specific message (the field's own wording, or the tag that clashed).
 */
export function errorMessage(error: unknown): string {
  if (!(error instanceof DataError)) return ERROR_MESSAGES.network;
  const specific = error.code === 'validation' || error.code === 'duplicate_tag';
  if (specific && error.message !== error.code) return error.message;
  if (error.code === 'duplicate_tag')
    return ERROR_MESSAGES.duplicate_tag.replace('Tag {tag}', 'This tag');
  return ERROR_MESSAGES[error.code];
}
