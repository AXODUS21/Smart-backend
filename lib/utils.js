// Utility function to get full name from first_name and last_name
export function getFullName(firstName, lastName) {
  const first = firstName || '';
  const last = lastName || '';
  const fullName = `${first} ${last}`.trim();
  return fullName || null;
}

// Utility function to get display name (full name or fallback)
export function getDisplayName(firstName, lastName, fallback = '') {
  const fullName = getFullName(firstName, lastName);
  return fullName || fallback;
}

