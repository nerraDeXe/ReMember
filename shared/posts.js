import { normalisePostContent, postContentText } from './postContent.js';

export const POST_LIMITS = Object.freeze({
  title: 120,
  subtitle: 200,
  description: 1000,
});

/** Keep the post editor and API consistent without accepting client-owned metadata. */
export function normalisePostInput(input = {}, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Provide a title, subtitle, and description for your post.');
  }
  const result = {};
  if (Object.hasOwn(input, 'descriptionContent') && input.descriptionContent !== null) {
    result.descriptionContent = normalisePostContent(input.descriptionContent, options);
    if (postContentText(result.descriptionContent, { trim: false }).length > POST_LIMITS.description) {
      throw new Error(`Description must be ${POST_LIMITS.description} characters or fewer.`);
    }
  }
  for (const [field, limit] of Object.entries(POST_LIMITS)) {
    const label = field[0].toUpperCase() + field.slice(1);
    const submitted = field === 'description' && result.descriptionContent ? postContentText(result.descriptionContent) : input[field];
    if (typeof submitted !== 'string' || !submitted.trim()) {
      throw new Error(`${label} is required.`);
    }
    const value = submitted.trim();
    if (value.length > limit) throw new Error(`${label} must be ${limit} characters or fewer.`);
    result[field] = value;
  }
  return result;
}
