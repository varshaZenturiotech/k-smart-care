export const translations = {
  en: {
    "auth.required": "name, email, password, district, and department are required.",
    "auth.exists": "An account with this email already exists.",
    "auth.reg_failed": "Registration failed.",
    "auth.login_required": "email and password are required.",
    "auth.invalid": "Invalid email or password.",
    "auth.login_failed": "Login failed.",
    "auth.not_found": "User not found.",
    "auth.lang_invalid": "preferredLanguage must be 'auto', 'malayalam', or 'english'.",
    "auth.lang_failed": "Failed to update preferred language.",
    "task.nlp_required": "Missing or invalid 'text' in request body.",
    "task.create_failed": "Failed to create task.",
    "task.retrieve_failed": "Failed to retrieve tasks.",
    "task.today_failed": "Failed to retrieve today's tasks.",
    "task.upcoming_failed": "Failed to retrieve upcoming tasks.",
    "task.overdue_failed": "Failed to retrieve overdue tasks.",
    "task.meeting_failed": "Failed to retrieve scheduled meeting tasks.",
    "task.update_failed": "Failed to update task.",
    "task.update_status_failed": "Failed to update task status.",
    "task.delete_failed": "Failed to delete task.",
    "task.nlp_failed": "Failed to create task from NLP.",
    "task.title_required": "Task title is required.",
    "common.error": "Something went wrong."
  },
  ml: {
    "auth.required": "പേര്, ഇമെയിൽ, പാസ്‌വേഡ്, ജില്ല, വകുപ്പ് എന്നിവ ആവശ്യമാണ്.",
    "auth.exists": "ഈ ഇമെയിലിൽ ഒരു അക്കൗണ്ട് നിലവിലുണ്ട്.",
    "auth.reg_failed": "രജിസ്ട്രേഷൻ പരാജയപ്പെട്ടു.",
    "auth.login_required": "ഇമെയിലും പാസ്‌വേഡും ആവശ്യമാണ്.",
    "auth.invalid": "അസാധുവായ ഇമെയിൽ അല്ലെങ്കിൽ പാസ്‌വേഡ്.",
    "auth.login_failed": "ലോഗിൻ പരാജയപ്പെട്ടു.",
    "auth.not_found": "ഉപയോക്താവിനെ കണ്ടെത്തിയില്ല.",
    "auth.lang_invalid": "ഭാഷാ മുൻഗണന 'auto', 'malayalam', അല്ലെങ്കിൽ 'english' ആയിരിക്കണം.",
    "auth.lang_failed": "ഭാഷാ മുൻഗണന പുതുക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.nlp_required": "ശരീരത്തിൽ 'text' കാണുന്നില്ല അല്ലെങ്കിൽ അസാധുവാണ്.",
    "task.create_failed": "ടാസ്ക് സൃഷ്ടിക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.retrieve_failed": "ടാസ്കുകൾ വീണ്ടെടുക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.today_failed": "ഇന്നത്തെ ടാസ്കുകൾ വീണ്ടെടുക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.upcoming_failed": "വരാനിരിക്കുന്ന ടാസ്കുകൾ വീണ്ടെടുക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.overdue_failed": "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ വീണ്ടെടുക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.meeting_failed": "ക്രമീകരിച്ച യോഗങ്ങൾ വീണ്ടെടുക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.update_failed": "ടാസ്ക് പുതുക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.update_status_failed": "ടാസ്ക് നില പുതുക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.delete_failed": "ടാസ്ക് ഇല്ലാതാക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.nlp_failed": "എൻ.എൽ.പി-യിൽ നിന്ന് ടാസ്ക് സൃഷ്ടിക്കുന്നതിൽ പരാജയപ്പെട്ടു.",
    "task.title_required": "ടാസ്കിന്റെ പേര് ആവശ്യമാണ്.",
    "common.error": "എന്തോ പിശക് സംഭവിച്ചു."
  }
};

export function translate(lang, key, defaultVal) {
  const dictionary = translations[lang] || translations["en"];
  return dictionary[key] || defaultVal || key;
}
