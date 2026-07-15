// Single source of truth for department names. Using a fixed list (instead
// of free text) is what makes matching reliable: an AI classifier can only
// "guess right" if it's choosing from the same list an employee's profile
// uses.
export const DEPARTMENTS = [
  "Local Self Government",
  "Health",
  "Revenue",
  "Engineering & PWD",
  "Education",
  "Agriculture",
  "Disaster Management",
  "Finance",
  "General Administration",
];

// Special marker meaning "relevant to every department" — distinct from a
// real department name so filtering logic can special-case it.
export const ALL_DEPARTMENTS = "All Departments";
export const ALL_DISTRICTS = "All Districts";