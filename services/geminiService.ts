import { GoogleGenAI } from "@google/genai";
import { GroundingChunk } from '../types';

if (!process.env.API_KEY) {
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

interface ScrapeResult {
  text: string;
  sources: { uri: string; title: string }[];
}

export const scrapeWithGrounding = async (query: string, sites: string[], excludedSites: string[]): Promise<ScrapeResult> => {
  const MAX_RETRIES = 3;
  let delay = 1000; // Start with 1 second

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const model = 'gemini-2.5-flash';
      
      // Construct a Google Search query with priority sites and excluded sites.
      const siteSearchQuery = sites.map(site => `site:${site.trim()}`).join(' OR ');
      const excludeQuery = excludedSites.map(site => `-site:${site.trim()}`).join(' ');
      const fullQuery = `${query} ${siteSearchQuery} ${excludeQuery}`.trim();

      const systemInstruction = `
You are a specialized news extraction assistant. Your task is to answer the user's query based ONLY on the information returned by a site-restricted Google Search.

**Your instructions are**:
1.  **Strict Source Adherence**: Provide an answer synthesized exclusively from the search results. DO NOT use any other information or websites.
2.  **Recency Requirement**: Prioritize information published within the last 48 hours.
3.  **Mandatory Citation**: You MUST cite the specific article title and URL for all pieces of information in your answer.
4.  **Failure Condition**: If the search results do not contain a relevant answer from the last 48 hours, you MUST respond with the exact phrase: "The requested information could not be found on the provided websites within the last 48 hours." Do not apologize or add extra text.
`.trim();

      const response = await ai.models.generateContent({
        model: model,
        contents: fullQuery,
        config: {
          systemInstruction: systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
      
      const sources = groundingChunks
        ?.map(chunk => chunk.web)
        .filter((web): web is { uri: string; title: string } => !!web && !!web.uri)
        .reduce((acc, current) => {
          if (!acc.find(item => item.uri === current.uri)) {
            acc.push(current);
          }
          return acc;
        }, [] as { uri: string; title: string }[]) || [];

      return { text, sources }; // Success, exit loop

    } catch (error: any) {
      if (error?.status === 503 && i < MAX_RETRIES - 1) {
        console.warn(`Model is overloaded. Retrying in ${delay / 1000}s... (${i + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }

      console.error("Error calling Gemini API:", error);
      if (error instanceof Error) {
          if (error.message.includes('API key not valid')) {
              throw new Error('The provided API key is not valid. Please check your environment configuration.');
          }
      }
      if (error?.status === 503) {
          throw new Error('The model is currently overloaded. Please try again later.');
      }
      throw new Error("Failed to fetch data from Gemini API.");
    }
  }
  // This should not be reached if MAX_RETRIES > 0, but is a fallback.
  throw new Error("Failed to fetch data from Gemini API after multiple retries.");
};
