/**
 * Service to calculate daily wellness score, focus score, and burnout risk
 * based on employee questionnaire inputs.
 */

const MOOD_SCORES = {
  great: 100,
  good: 80,
  okay: 60,
  tired: 40,
  overwhelmed: 20,
};

const SLEEP_SCORES = {
  "8+": 100,
  "6-7": 80,
  "4-5": 50,
  "<4": 20,
};

const ENERGY_SCORES = {
  Excellent: 100,
  High: 80,
  Moderate: 60,
  Low: 40,
  "Very Low": 20,
};

const STRESS_SCORES = {
  "Very Low": 100,
  Low: 85,
  Moderate: 60,
  High: 30,
  "Very High": 10,
};

const WORKLOAD_SCORES = {
  Light: 100,
  Normal: 80,
  Heavy: 50,
  "Very Heavy": 20,
};

// Custom mapping for workload focus points (Normal workload is optimal for focus)
const WORKLOAD_FOCUS_SCORES = {
  Normal: 100,
  Light: 80,
  Heavy: 60,
  "Very Heavy": 30,
};

export function calculateScores({ mood, sleepHours, energy, stress, workload }) {
  // 1. Resolve points for each category
  const moodPoints = MOOD_SCORES[mood] || 60;
  const sleepPoints = SLEEP_SCORES[sleepHours] || 60;
  const energyPoints = ENERGY_SCORES[energy] || 60;
  const stressPoints = STRESS_SCORES[stress] || 60;
  const workloadPoints = WORKLOAD_SCORES[workload] || 60;

  // 2. Calculate Wellness Score (0-100)
  // Weights: Mood (30%), Sleep (20%), Energy (20%), Stress (20%), Workload (10%)
  const wellnessScore = Math.round(
    moodPoints * 0.3 +
    sleepPoints * 0.2 +
    energyPoints * 0.2 +
    stressPoints * 0.2 +
    workloadPoints * 0.1
  );

  // 3. Calculate Focus Score (0-100)
  // Weights: Sleep (30%), Energy (30%), Stress (30%), Workload (10%)
  const workloadFocusPoints = WORKLOAD_FOCUS_SCORES[workload] || 60;
  const focusScore = Math.round(
    sleepPoints * 0.3 +
    energyPoints * 0.3 +
    stressPoints * 0.3 +
    workloadFocusPoints * 0.1
  );

  // 4. Calculate Burnout Risk (Low, Medium, High)
  // High workload, high stress, low sleep, low energy increase burnout risk.
  // Inverse scores to represent burnout contribution (higher = worse)
  const stressBurnoutVal = 100 - stressPoints; // high stress -> high burnout
  const workloadBurnoutVal = 100 - workloadPoints; // heavy workload -> high burnout
  
  // Inverse energy and sleep
  const energyBurnoutVal = 100 - energyPoints;
  const sleepBurnoutVal = 100 - sleepPoints;

  // Burnout index calculation (Weights: Stress 40%, Workload 30%, Energy 15%, Sleep 15%)
  const burnoutIndex =
    stressBurnoutVal * 0.4 +
    workloadBurnoutVal * 0.3 +
    energyBurnoutVal * 0.15 +
    sleepBurnoutVal * 0.15;

  let burnoutRisk = "Low";
  if (burnoutIndex >= 70) {
    burnoutRisk = "High";
  } else if (burnoutIndex >= 40) {
    burnoutRisk = "Medium";
  }

  return {
    wellnessScore,
    focusScore,
    burnoutRisk,
  };
}
