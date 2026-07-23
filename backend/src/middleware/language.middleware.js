/**
 * Language Middleware for K-SMART CARE Backend API.
 * Reads Accept-Language header, query parameters, or user preference and populates req.language.
 *
 * Supported language codes:
 * - 'ml', 'ml-IN' -> 'ml' (Malayalam)
 * - 'en', 'en-US', 'en-GB' -> 'en' (English - Default)
 */
export function languageMiddleware(req, res, next) {
  let lang = 'en'; // Default fallback

  const customHeader = req.headers['x-preferred-language'];
  const queryLang = req.query?.lang || req.query?.language;
  const acceptHeader = req.headers['accept-language'];

  if (customHeader && typeof customHeader === 'string') {
    const cLower = customHeader.trim().toLowerCase();
    if (cLower === 'ml' || cLower.includes('ml') || cLower === 'malayalam') {
      lang = 'ml';
    } else if (cLower === 'en' || cLower.includes('en') || cLower === 'english') {
      lang = 'en';
    }
  } else if (queryLang && typeof queryLang === 'string') {
    const qLower = queryLang.trim().toLowerCase();
    if (qLower === 'ml' || qLower === 'ml-in' || qLower === 'malayalam') {
      lang = 'ml';
    } else if (qLower === 'en' || qLower === 'en-us' || qLower === 'english') {
      lang = 'en';
    }
  } else if (acceptHeader && typeof acceptHeader === 'string') {
    const headerLower = acceptHeader.toLowerCase();
    if (headerLower.includes('ml-in') || headerLower.includes('ml') || headerLower.includes('malayalam')) {
      lang = 'ml';
    }
  }

  req.language = lang;
  next();
}

export default languageMiddleware;
