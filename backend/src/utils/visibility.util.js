import { ALL_DEPARTMENTS, ALL_DISTRICTS } from "../config/departments.js";

/**
 * An item (circular or news) is visible to an employee only if it passes
 * BOTH scopes:
 *  - department scope: tagged with the employee's department, OR tagged
 *    "All Departments"
 *  - district scope: tagged with the employee's district, OR tagged
 *    "All Districts" (the default for most circulars, meaning "not
 *    restricted to one district")
 *
 * These AND together rather than OR — otherwise, since most circulars
 * default to district="All Districts", that alone would make almost every
 * circular visible to every employee regardless of department, which
 * defeats the point of tagging at all. The practical effect of this rule:
 * an employee sees their own department's circulars (from any district),
 * plus anything state-wide, plus anything specific to their own district.
 */
export function isVisibleToEmployee(item, employee) {
  const departments = item.departments || [];
  const departmentScope = departments.includes(employee.department) || departments.includes(ALL_DEPARTMENTS);
  const districtScope = item.district === employee.district || item.district === ALL_DISTRICTS;

  return departmentScope && districtScope;
}

/** Builds a Mongo query object equivalent to isVisibleToEmployee(), so
 * filtering happens in the database instead of pulling everything and
 * filtering in JS. */
export function visibilityQuery(employee) {
  return {
    $and: [
      { departments: { $in: [employee.department, ALL_DEPARTMENTS] } },
      { district: { $in: [employee.district, ALL_DISTRICTS] } },
    ],
  };
}