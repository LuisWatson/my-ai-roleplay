export const USER_ROLE_FIELDS = ['name', 'callMe', 'description', 'personality', 'likes', 'dislikes'];

const MAX_FIELD_LENGTH = 600;

/**
 * Coerce untrusted input (localStorage, backup file) into a role object with only known string fields.
 */
export function normalizeUserRole(raw) {
  const role = {};
  for (const field of USER_ROLE_FIELDS) {
    role[field] = typeof raw?.[field] === 'string' ? raw[field].slice(0, MAX_FIELD_LENGTH) : '';
  }
  return role;
}

/**
 * Per-character role overrides the general profile field by field; empty fields fall back to the general profile.
 */
export function mergeUserProfile(baseProfile, role) {
  const merged = {};
  for (const field of USER_ROLE_FIELDS) {
    merged[field] = role?.[field]?.trim() ? role[field] : baseProfile?.[field] || '';
  }
  return merged;
}
