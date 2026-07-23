/**
 * Context Detector for K-SMART CARE Localization Engine
 * Smartly infers the application category, component type, prompt name, tone, and length constraints.
 */

/**
 * Infer context details from input string and optional metadata.
 * 
 * @param {string} text Source English text string.
 * @param {Object} [options] Optional metadata overrides.
 * @param {string} [options.category] Explicit category override.
 * @param {string} [options.component] Explicit component override.
 * @param {string} [options.endpoint] HTTP Endpoint context (e.g., /api/wellness).
 * @param {string} [options.key] i18n JSON key path (e.g., 'wellness.howFeeling').
 * @returns {{category: string, component: string, promptName: string, tone: string, maxLength: number|null}}
 */
export function detectContext(text, options = {}) {
  if (options.category && options.component) {
    return {
      category: options.category,
      component: options.component,
      promptName: `${options.category} Prompt`,
      tone: options.tone || "Professional",
      maxLength: options.maxLength !== undefined ? options.maxLength : null
    };
  }

  const rawText = (text || "").trim();
  const lowerText = rawText.toLowerCase();
  const lowerKey = (options.key || "").toLowerCase();
  const lowerEndpoint = (options.endpoint || "").toLowerCase();

  // 1. Meeting Detection (High Priority for Committee / Steering / Ward / Panchayat meetings)
  const isMeetingKeyword = /steering|ward|committee|meeting|conference/i.test(lowerText) ||
                           lowerKey.includes('meeting') || lowerEndpoint.includes('meeting');

  if (isMeetingKeyword) {
    if (/ward|development/i.test(lowerText)) {
      return {
        category: "Meeting",
        component: "Committee Meeting",
        promptName: "Meeting Prompt",
        tone: "Formal Committee Title",
        maxLength: 8
      };
    }
    return {
      category: "Meeting",
      component: "Meeting Title",
      promptName: "Meeting Prompt",
      tone: "Formal Event Title",
      maxLength: 8
    };
  }

  // 2. Task Detection
  const isTaskKeyword = /approve|review|disbursement|fund|leave|request|task|submit report|follow-up|file/i.test(lowerText) ||
                        lowerKey.includes('task') || lowerEndpoint.includes('task');

  if (isTaskKeyword) {
    if (/approve|leave|request/i.test(lowerText)) {
      return {
        category: "Task",
        component: "Approval Request",
        promptName: "Task Prompt",
        tone: "Actionable, Office Speech",
        maxLength: 12
      };
    }
    return {
      category: "Task",
      component: "Task Title",
      promptName: "Task Prompt",
      tone: "Concise Office Speech",
      maxLength: 10
    };
  }

  // 3. Circular Detection
  const isCircularKeyword = /circular|government order|directive|notification|gazette|order/i.test(lowerText) ||
                            lowerKey.includes('circular') || lowerEndpoint.includes('circular');

  if (isCircularKeyword) {
    return {
      category: "Circular",
      component: "Government Order",
      promptName: "Circular Prompt",
      tone: "Formal Government",
      maxLength: null
    };
  }

  // 4. Button Detection (Action labels)
  const isButtonKeyword = lowerKey.includes('button') || lowerKey.includes('action') ||
                          (/^(create|add|new|submit|save|delete|cancel|confirm|start|skip|download|upload|view)\b/i.test(lowerText) && rawText.split(/\s+/).length <= 4);

  if (isButtonKeyword) {
    return {
      category: "Button",
      component: "Action Button",
      promptName: "Button Prompt",
      tone: "Direct Action",
      maxLength: 3
    };
  }

  // 5. Validation Error Detection
  const isValidationKeyword = /required|invalid|must be|missing|enter valid|error/i.test(lowerText) ||
                              lowerKey.includes('error') || lowerKey.includes('validation');

  if (isValidationKeyword) {
    return {
      category: "Validation",
      component: "Error Message",
      promptName: "Validation Prompt",
      tone: "Friendly, Clear",
      maxLength: 15
    };
  }

  // 6. Wellness & Wellbeing Detection
  const isWellnessKeyword = /feeling|stress|mood|sleep|energy|workload|wellbeing|checkin|mental|burnout/i.test(lowerText) ||
                            lowerKey.includes('wellness');

  if (isWellnessKeyword) {
    return {
      category: "Wellness",
      component: "Wellbeing Assessment",
      promptName: "Wellness Prompt",
      tone: "Warm, Empathetic",
      maxLength: null
    };
  }

  // 7. Dashboard Detection
  const isDashboardKeyword = /snapshot|briefing|overview|analytics|today's work|metric/i.test(lowerText) ||
                             lowerKey.includes('dashboard') || lowerEndpoint.includes('dashboard');

  if (isDashboardKeyword) {
    return {
      category: "Dashboard",
      component: "Dashboard Card",
      promptName: "Dashboard Prompt",
      tone: "Informative Summary",
      maxLength: 8
    };
  }

  // 8. Explicit Navigation Items
  const isNavKeyword = /home|task planner|circular repository|admin console|sidebar|menu item/i.test(lowerText) ||
                       lowerKey.includes('nav');

  if (isNavKeyword) {
    return {
      category: "Navigation",
      component: "Navigation Item",
      promptName: "Navigation Prompt",
      tone: "Direct",
      maxLength: 3
    };
  }

  // Default fallback context
  return {
    category: "General",
    component: "UI Element",
    promptName: "General Prompt",
    tone: "Professional, Clear",
    maxLength: null
  };
}

export default {
  detectContext
};
