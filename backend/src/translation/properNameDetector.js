/**
 * Proper Name & Entity Detector for K-SMART CARE Localization Engine
 * Detects proper names, districts, government IDs, numbers, dates, and reference codes
 * to bypass LLM translation entirely.
 */

const KERALA_DISTRICTS = new Set([
  'thiruvananthapuram', 'trivandrum', 'kollam', 'quilon', 'pathanamthitta',
  'alappuzha', 'alleppey', 'kottayam', 'idukki', 'ernakulam', 'kochi', 'cochin',
  'thrissur', 'trichur', 'palakkad', 'palghat', 'malappuram', 'kozhikode', 'calicut',
  'wayanad', 'kannur', 'cannanore', 'kasaragod', 'kasargod'
]);

const KERALA_MUNICIPALITIES = new Set([
  'neeyattinkara', 'varkala', 'atteningal', 'karunagappally', 'punalur',
  'thiruvalla', 'chengannur', 'kayamkulam', 'mavelikkara', 'changanassery',
  'pala', 'etumanur', 'thodupuzha', 'aluva', 'perumbavoor', 'angamaly',
  'mupathana', 'thrippunithura', 'kalamassery', 'maradu', 'kothamangalam',
  'chalakudy', 'kodungallur', 'kunnamkulam', 'guruvayur', 'chittur-thathamangalam',
  'shornur', 'ottapalam', 'mannarkkad', 'pattambi', 'tirur', 'ponnani',
  'perinthalmanna', 'vailathur', 'manjeri', 'kottakkal', 'malappuram',
  'vatakara', 'koyilandy', 'koduvally', 'mukkam', 'kalpetta', 'mananthavady',
  'sulthan bathery', 'thalassery', 'thalipparamba', 'payyannur', 'mattannur',
  'anthoor', 'kanhangad', 'kasaragod', 'nileshwaram'
]);

/**
 * Checks if a string is a Kerala district name
 */
export function isDistrict(str) {
  if (!str || typeof str !== 'string') return false;
  return KERALA_DISTRICTS.has(str.trim().toLowerCase());
}

/**
 * Checks if a string is a Kerala municipality or local body name
 */
export function isMunicipality(str) {
  if (!str || typeof str !== 'string') return false;
  return KERALA_MUNICIPALITIES.has(str.trim().toLowerCase());
}

/**
 * Checks if string is a numeric value, currency, percentage, or date/time pattern
 */
export function isNumericOrDate(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();

  // Plain number or currency/percentage
  if (/^[$₹€£]?\s*\d+([.,]\d+)?\s*%?$/.test(trimmed)) return true;

  // Date formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO strings)
  if (/^\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4}(T\d{2}:\d{2}:\d{2}.*)?$/i.test(trimmed)) return true;

  // Time format (e.g. 10:30 AM, 14:00)
  if (/^\d{1,2}:\d{2}(\s*:\d{2})?(\s*[AP]M)?$/i.test(trimmed)) return true;

  return false;
}

/**
 * Checks if string is a Government ID, Reference Code, MongoDB ObjectId, or UUID
 */
export function isGovernmentID(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();

  // MongoDB ObjectId (24 hex characters)
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return true;

  // UUID
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(trimmed)) return true;

  // Common Kerala Govt Ref Numbers (e.g., REF-2026-001, KL-LSGD-1049, DOC/2026/892)
  if (/^(REF|KL|LSGD|FILE|DOC|GO|ORD|CIRC|APP|REQ)[-/\._A-Z0-9]{3,}$/i.test(trimmed)) return true;

  // Email or URL
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;

  return false;
}

/**
 * Checks if string is a Person's Name (e.g., "Anjali Nair", "Rahul Varma", "K. P. Raman")
 */
export function isPersonName(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();

  // Standard Indian / Kerala Name Patterns (2-4 capitalized words with optional initials)
  if (/^([A-Z]\.\s*)*[A-Z][a-z]{1,20}(\s+([A-Z]\.\s*)*[A-Z][a-z]{1,20}){1,3}$/.test(trimmed)) {
    // Avoid matching common English phrases that happen to be Title Case
    const commonPhrases = new Set([
      "today's tasks", "today's meetings", "good morning", "casual leave",
      "earned leave", "flood relief", "steering committee", "gram sabha",
      "system settings", "wellness score", "workplace ai assistant"
    ]);
    if (!commonPhrases.has(trimmed.toLowerCase())) {
      // Check for common Kerala surnames / titles
      const nameKeywords = /nair|menon|varma|pillai|kurup|nambiar|panicker|prabhu|sharma|singh|rao|kumar|devi|ali|khan|joseph|thomas|george|mathew|varghese|alexander|das|nathan/i;
      if (nameKeywords.test(trimmed) || /^([A-Z]\.\s*){1,2}[A-Z][a-z]+/.test(trimmed)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Master Proper Entity Check
 * Returns true if text is a proper noun/entity that should bypass LLM translation.
 */
export function isProperEntity(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();

  if (isNumericOrDate(trimmed)) return true;
  if (isGovernmentID(trimmed)) return true;
  if (isDistrict(trimmed)) return true;
  if (isMunicipality(trimmed)) return true;
  if (isPersonName(trimmed)) return true;

  return false;
}

export default {
  isDistrict,
  isMunicipality,
  isNumericOrDate,
  isGovernmentID,
  isPersonName,
  isProperEntity
};
