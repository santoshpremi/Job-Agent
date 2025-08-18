import { isAvailable, getBestModel, generateText as openrouterGenerateText, completeWithTools as openrouterCompleteWithTools } from "./openrouter.js";
import { Groq } from "groq-sdk";

// Initialize Groq client
let groq = null;
try {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
} catch (error) {
  console.log("⚠️  Groq not available:", error.message);
}

// Provider availability cache
let providerCache = { openrouter: null, groq: null };

async function initializeProviders() {
  console.log("🔍 Initializing LLM providers...");
  try {
    providerCache.openrouter = await isAvailable();
    console.log(`✅ OpenRouter: ${providerCache.openrouter ? 'Available' : 'Unavailable'}`);
  } catch (error) {
    providerCache.openrouter = false;
    console.log(`❌ OpenRouter: Failed to initialize - ${error.message}`);
  }
  providerCache.groq = !!groq;
  console.log(`✅ Groq: ${providerCache.groq ? 'Available' : 'Unavailable'}`);
  console.log("🚀 Provider initialization complete!");
}

function getBestAvailableProvider() {
  if (providerCache.openrouter) return 'openrouter';
  if (providerCache.groq) return 'groq';
  return null;
}

function markProviderFailed(provider) {
  if (providerCache[provider] !== null) {
    providerCache[provider] = false;
    console.log(`⚠️  Marked ${provider} as failed, will use next available provider`);
  }
}

export async function completeWithTools(args) {
  if (providerCache.openrouter === null) { 
    await initializeProviders(); 
  }
  
  // Priority 1: Try OpenRouter
  if (providerCache.openrouter) {
    try {
      console.log("🚀 Using OpenRouter for tool completion");
      return await openrouterCompleteWithTools(args);
    } catch (error) {
      console.log(`❌ OpenRouter failed: ${error.message}`);
      markProviderFailed('openrouter');
    }
  }
  
  // Priority 2: Try Groq as fallback
  if (providerCache.groq) {
    try {
      console.log("⚠️  OpenRouter unavailable, using Groq fallback");
      
      // Try deepseek-r1-distill-llama-70b model first (better success rate)
      try {
        console.log("🚀 Trying deepseek-r1-distill-llama-70b model");
        return await groq.chat.completions.create({
          ...args,
          model: "deepseek-r1-distill-llama-70b",
          temperature: 0.7,
          max_tokens: 8192,
          stream: false
        });
      } catch (deepseekError) {
        console.log(`❌ Deepseek model failed: ${deepseekError.message}, trying gpt-oss-20b`);
        
        // Fallback to gpt-oss-20b if deepseek fails
        return await groq.chat.completions.create({
          ...args,
          model: "openai/gpt-oss-20b",
          temperature: 0.7,
          max_tokens: 8192,
          stream: false
        });
      }
    } catch (error) {
      console.log(`❌ Groq failed: ${error.message}`);
      markProviderFailed('groq');
    }
  }
  
  throw new Error("All LLM providers failed. Please check your API keys and try again.");
}

export async function generateText(prompt, model = null) {
  if (providerCache.openrouter === null) { 
    await initializeProviders(); 
  }
  
  // Priority 1: Try OpenRouter
  if (providerCache.openrouter) {
    try {
      console.log("🚀 Using OpenRouter for text generation");
      return await openrouterGenerateText(prompt, model);
    } catch (error) {
      console.log(`❌ OpenRouter failed: ${error.message}`);
      markProviderFailed('openrouter');
    }
  }
  
  // Priority 2: Try Groq as fallback
  if (providerCache.groq) {
    try {
      console.log("⚠️  OpenRouter unavailable, using Groq fallback");
      
      // Try deepseek-r1-distill-llama-70b model first (better success rate)
      try {
        console.log("🚀 Trying deepseek-r1-distill-llama-70b model");
        const completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "deepseek-r1-distill-llama-70b",
          temperature: 0.7,
          max_tokens: 8192,
          stream: false
        });
        return completion.choices[0].message.content;
      } catch (deepseekError) {
        console.log(`❌ Deepseek model failed: ${deepseekError.message}, trying gpt-oss-20b`);
        
        // Fallback to gpt-oss-20b if deepseek fails
        const completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "openai/gpt-oss-20b",
          temperature: 0.7,
          max_tokens: 8192,
          stream: false
        });
        return completion.choices[0].message.content;
      }
    } catch (error) {
      console.log(`❌ Groq failed: ${error.message}`);
      markProviderFailed('groq');
    }
  }
  
  throw new Error("All LLM providers failed. Please check your API keys and try again.");
}

export function getProviderStatus() {
  return {
    openrouter: providerCache.openrouter,
    groq: providerCache.groq,
    bestAvailable: getBestAvailableProvider()
  };
}

export function resetProviderCache() {
  providerCache = { openrouter: null, groq: null };
  console.log("🔄 Provider cache reset");
}