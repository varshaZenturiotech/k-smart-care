import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized LLM Client Wrapper Service.
 * SOLID-compliant and provider-agnostic, centralizing ChatGroq client creation and execution.
 */
class LLMService {
  constructor() {
    this.defaultModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
    this.defaultTemperature = 0.3;
  }

  /**
   * Validates if the configured API key is available.
   * @returns {boolean}
   */
  hasKey() {
    const apiKey = process.env.GROQ_API_KEY;
    return Boolean(apiKey && apiKey !== "your_groq_api_key_here" && apiKey.trim() !== "");
  }

  /**
   * Instantiates the LLM client.
   * @param {Object} options
   * @returns {ChatGroq}
   */
  createClient(options = {}) {
    if (!this.hasKey()) {
      throw new Error("LLM API Key is not configured.");
    }

    const apiKey = process.env.GROQ_API_KEY;
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? this.defaultTemperature;

    return new ChatGroq({
      apiKey,
      model,
      temperature,
    });
  }

  /**
   * Generates text completion given a prompt template string and variable inputs.
   * @param {string} promptTemplateStr
   * @param {Object} variables
   * @param {Object} options
   * @returns {Promise<string|null>}
   */
  async generateCompletion(promptTemplateStr, variables = {}, options = {}) {
    if (!this.hasKey()) {
      return null;
    }

    try {
      const llm = this.createClient(options);
      const prompt = PromptTemplate.fromTemplate(promptTemplateStr);
      const parser = new StringOutputParser();
      const chain = prompt.pipe(llm).pipe(parser);

      const response = await chain.invoke(variables);
      return response ? response.trim() : "";
    } catch (err) {
      console.error("[LLMService] Error generating completion:", err.message);
      throw err;
    }
  }
}

export const llmService = new LLMService();
export default llmService;
