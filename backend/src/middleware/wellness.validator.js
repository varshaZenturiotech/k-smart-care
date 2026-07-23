/**
 * Validator and Normalizer for Wellness Check inputs
 */

const VALID_MOODS = ["great", "good", "okay", "tired", "overwhelmed"];
const VALID_SLEEP_HOURS = ["<4", "4-5", "6-7", "8+"];

const ENERGY_MAP = {
  "very low": "Very Low",
  "low": "Low",
  "moderate": "Moderate",
  "high": "High",
  "excellent": "Excellent",
  "വളരെ കുറഞ്ഞ": "Very Low",
  "കുറഞ്ഞ": "Low",
  "മിതമായ": "Moderate",
  "ഉയർന്ന": "High",
  "മികച്ച": "Excellent",
};

const STRESS_MAP = {
  "very low": "Very Low",
  "low": "Low",
  "moderate": "Moderate",
  "high": "High",
  "very high": "Very High",
  "വളരെ കുറഞ്ഞ": "Very Low",
  "കുറഞ്ഞ": "Low",
  "മിതമായ": "Moderate",
  "ഉയർന്ന": "High",
  "വളരെ ഉയർന്ന": "Very High",
};

const WORKLOAD_MAP = {
  "light": "Light",
  "normal": "Normal",
  "heavy": "Heavy",
  "very heavy": "Very Heavy",
  "ലളിതം": "Light",
  "സാധാരണ": "Normal",
  "ഭാരം": "Heavy",
  "വളരെ ഭാരം": "Very Heavy",
};

export function validateCheckin(req, res, next) {
  let { mood, sleepHours, energy, stress, workload, note } = req.body;

  // 1. Mood validation
  if (mood && typeof mood === "string") {
    mood = mood.trim().toLowerCase();
  }
  if (!mood || !VALID_MOODS.includes(mood)) {
    return res.status(400).json({
      error: `Invalid or missing 'mood'. Must be one of: ${VALID_MOODS.join(", ")}`,
    });
  }
  req.body.mood = mood;

  // 2. Sleep hours validation
  if (sleepHours && typeof sleepHours === "string") {
    sleepHours = sleepHours.trim();
  }
  if (!sleepHours || !VALID_SLEEP_HOURS.includes(sleepHours)) {
    return res.status(400).json({
      error: `Invalid or missing 'sleepHours'. Must be one of: ${VALID_SLEEP_HOURS.join(", ")}`,
    });
  }
  req.body.sleepHours = sleepHours;

  // 3. Energy validation
  const normalizedEnergy = energy && typeof energy === "string" ? ENERGY_MAP[energy.trim().toLowerCase()] || ENERGY_MAP[energy.trim()] : null;
  if (!normalizedEnergy) {
    return res.status(400).json({
      error: `Invalid or missing 'energy'. Must be one of: Very Low, Low, Moderate, High, Excellent`,
    });
  }
  req.body.energy = normalizedEnergy;

  // 4. Stress validation
  const normalizedStress = stress && typeof stress === "string" ? STRESS_MAP[stress.trim().toLowerCase()] || STRESS_MAP[stress.trim()] : null;
  if (!normalizedStress) {
    return res.status(400).json({
      error: `Invalid or missing 'stress'. Must be one of: Very Low, Low, Moderate, High, Very High`,
    });
  }
  req.body.stress = normalizedStress;

  // 5. Workload validation
  const normalizedWorkload = workload && typeof workload === "string" ? WORKLOAD_MAP[workload.trim().toLowerCase()] || WORKLOAD_MAP[workload.trim()] : null;
  if (!normalizedWorkload) {
    return res.status(400).json({
      error: `Invalid or missing 'workload'. Must be one of: Light, Normal, Heavy, Very Heavy`,
    });
  }
  req.body.workload = normalizedWorkload;

  // 6. Note validation
  if (note && typeof note !== "string") {
    return res.status(400).json({
      error: "'note' must be a string",
    });
  }

  next();
}
