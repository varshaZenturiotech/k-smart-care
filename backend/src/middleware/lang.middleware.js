import { verifyToken } from "../utils/jwt.util.js";
import User from "../models/User.model.js";
import { translate } from "../utils/translate.js";

export async function detectLanguage(req, res, next) {
  let lang = "en"; // default fallback

  // 1. Check query param or custom header (e.g., x-preferred-language, ?lang=en, ?language=english)
  const queryLang = req.query?.lang || req.query?.language;
  const headerLang = req.headers["x-preferred-language"];
  const langCandidate = queryLang || headerLang;

  if (langCandidate && (langCandidate === "english" || langCandidate === "malayalam" || langCandidate === "en" || langCandidate === "ml")) {
    lang = (langCandidate === "malayalam" || langCandidate === "ml") ? "ml" : "en";
  } else {
    // 2. Check token in Authorization header to resolve user language preference
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const payload = verifyToken(token);
        if (payload && payload.id) {
          const user = await User.findById(payload.id).select("preferredLanguage");
          if (user && user.preferredLanguage) {
            if (user.preferredLanguage === "malayalam") {
              lang = "ml";
            } else if (user.preferredLanguage === "english") {
              lang = "en";
            } else if (user.preferredLanguage === "auto") {
              // Fallback to browser Accept-Language
              const acceptLang = req.headers["accept-language"];
              if (acceptLang && acceptLang.toLowerCase().includes("ml")) {
                lang = "ml";
              }
            }
          }
        }
      } catch (err) {
        // Suppress / ignore invalid token issues (will be handled by requireAuth if it's a protected route)
      }
    } else {
      // 3. Fallback to Accept-Language for unauthenticated requests
      const acceptLang = req.headers["accept-language"];
      if (acceptLang && acceptLang.toLowerCase().includes("ml")) {
        lang = "ml";
      }
    }
  }

  req.language = lang;
  req.t = (key, defaultText) => translate(lang, key, defaultText);

  next();
}
