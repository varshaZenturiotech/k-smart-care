/**
 * Validator for Wellness Check inputs
 */

const VALID_MOODS = ["great", "good", "okay", "tired", "overwhelmed"];
const VALID_SLEEP_HOURS = ["<4", "4-5", "6-7", "8+"];
const VALID_ENERGIES = ["Very Low", "Low", "Moderate", "High", "Excellent"];
const VALID_STRESS_LEVELS = ["Very Low", "Low", "Moderate", "High", "Very High"];
const VALID_WORKLOADS = ["Light", "Normal", "Heavy", "Very Heavy"];

export function validateCheckin(req, res, next) {
  const { mood, sleepHours, energy, stress, workload, note } = req.body;

  if (!mood || !VALID_MOODS.includes(mood)) {
    return res.status(400).json({
      error: `Invalid or missing 'mood'. Must be one of: ${VALID_MOODS.join(", ")}`,
    });
  }

  if (!sleepHours || !VALID_SLEEP_HOURS.includes(sleepHours)) {
    return res.status(400).json({
      error: `Invalid or missing 'sleepHours'. Must be one of: ${VALID_SLEEP_HOURS.join(", ")}`,
    });
  }

  if (!energy || !VALID_ENERGIES.includes(energy)) {
    return res.status(400).json({
      error: `Invalid or missing 'energy'. Must be one of: ${VALID_ENERGIES.join(", ")}`,
    });
  }

  if (!stress || !VALID_STRESS_LEVELS.includes(stress)) {
    return res.status(400).json({
      error: `Invalid or missing 'stress'. Must be one of: ${VALID_STRESS_LEVELS.join(", ")}`,
    });
  }

  if (!workload || !VALID_WORKLOADS.includes(workload)) {
    return res.status(400).json({
      error: `Invalid or missing 'workload'. Must be one of: ${VALID_WORKLOADS.join(", ")}`,
    });
  }

  if (note && typeof note !== "string") {
    return res.status(400).json({
      error: "'note' must be a string",
    });
  }

  next();
}
