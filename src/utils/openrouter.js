import OpenAI from "openai";

// Initialize OpenRouter client
let openrouter = null;
try {
  openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Job Agent"
    }
  });
} catch (error) {
  console.log("⚠️  OpenRouter not available:", error.message);
}

// Model recommendations for different use cases
const modelRecommendations = {
  tool_calling: [
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3.1-8b-instruct"
  ],
  text_generation: [
    "openai/gpt-4o-mini",
    "openai/gpt-oss-20b:free",
    "meta-llama/llama-3.1-8b-instruct",
    "microsoft/phi-3-mini-4k-instruct"
  ],
  job_extraction: [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3.1-8b-instruct",
    "openai/gpt-oss-20b:free"
  ]
};

export async function isAvailable() {
  if (!openrouter || !process.env.OPENROUTER_API_KEY) {
    return false;
  }
  
  try {
    // Test with a simple completion
    const response = await openrouter.chat.completions.create({
      model: "openai/gpt-oss-20b:free",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 10
    });
    return true;
  } catch (error) {
    console.log("❌ OpenRouter test failed:", error.message);
    return false;
  }
}

export async function getBestModel(useCase = 'general') {
  const models = modelRecommendations[useCase] || modelRecommendations.text_generation;
  
  for (const model of models) {
    try {
      // Test if model supports the use case
      if (useCase === 'tool_calling') {
        // Test tool calling capability
        const response = await openrouter.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: "What's 2+2?" }],
          tools: [{
            type: "function",
            function: {
              name: "test",
              description: "Test function",
              parameters: { type: "object", properties: {} }
            }
          }],
          tool_choice: "auto",
          max_tokens: 50
        });
        return model;
      } else {
        // Test basic completion
        const response = await openrouter.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 10
        });
        return model;
      }
    } catch (error) {
      console.log(`❌ Model ${model} not available:`, error.message);
      continue;
    }
  }
  
  // Fallback to a known working model
  return "openai/gpt-oss-20b:free";
}

export async function generateText(prompt, model = null) {
  if (!openrouter) {
    throw new Error("OpenRouter not available");
  }
  
  const selectedModel = model || await getBestModel('text_generation');
  
  try {
    const completion = await openrouter.chat.completions.create({
      model: selectedModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.7
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.log(`❌ OpenRouter API call failed: ${error.message}`);
    throw error;
  }
}

export async function completeWithTools(args) {
  if (!openrouter) {
    throw new Error("OpenRouter not available");
  }
  
  const selectedModel = args.model || await getBestModel('tool_calling');
  
  try {
    const completion = await openrouter.chat.completions.create({
      model: selectedModel,
      messages: args.messages,
      tools: args.tools || [],
      tool_choice: args.tool_choice || 'auto',
      max_tokens: args.max_tokens || 4000,
      temperature: args.temperature || 0.7
    });
    
    return completion;
  } catch (error) {
    console.log(`❌ OpenRouter API call failed: ${error.message}`);
    throw error;
  }
}

export { openrouter };
