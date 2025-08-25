// Store API keys in memory
let apiKey = '';
let serpApiKey = '';

// Generic LLM client storage
let llmClient = null;
let clientType = null; // 'url+key' or 'key-only'

// Function to update settings with smart provider detection
export async function updateSettings(settings) {
  apiKey = settings.apiKey || '';
  serpApiKey = settings.serpApiKey || '';

  // Reset previous client
  llmClient = null;
  clientType = null;

  if (apiKey) {
    // Check if it's a Groq API key (starts with 'gsk_')
    if (apiKey.startsWith('gsk_')) {
      // Groq - uses SDK, no URL needed
      try {
        llmClient = await initializeGroqProvider(apiKey);
        clientType = 'groq-sdk';
        providerCache.llm = true;
        console.log("✅ Groq provider initialized (SDK-based, no URL needed)");
      } catch (error) {
        console.log(`❌ Groq initialization failed: ${error.message}`);
        llmClient = null;
        providerCache.llm = false;
      }
    } else if (settings.llmProviderUrl) {
      // OpenRouter/OpenAI/Others - need URL + API key
      try {
        llmClient = initializeUrlBasedProvider(apiKey, settings.llmProviderUrl);
        clientType = 'url+key';
        providerCache.llm = true;
        console.log(`✅ URL-based provider initialized: ${settings.llmProviderUrl}`);
      } catch (error) {
        console.log(`❌ Failed to initialize URL-based provider: ${error.message}`);
        llmClient = null;
        providerCache.llm = false;
      }
    } else {
      // Non-Groq key but no URL provided
      console.log("⚠️  Non-Groq API key provided but no URL - provider unavailable");
      llmClient = null;
      providerCache.llm = false;
    }
  } else {
    console.log("⚠️  No API key provided - LLM providers unavailable");
    providerCache.llm = false;
  }
}

// Initialize provider that needs URL + API key (like OpenRouter, custom endpoints)
function initializeUrlBasedProvider(apiKey, url) {
  try {
    // For now, we'll use a simple fetch-based approach that works with any URL
    // This avoids dependency issues and works with any OpenAI-compatible endpoint
    return {
      type: 'url+key',
      baseURL: url,
      apiKey: apiKey,
      // Simple completion function that works with any OpenAI-compatible API
      async chatCompletionsCreate(args) {
        const response = await fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Job Agent'
          },
          body: JSON.stringify({
            model: args.model || 'meta-llama/llama-3.1-8b-instruct',
            messages: args.messages,
            max_tokens: args.max_tokens || 4000,
            temperature: args.temperature || 0.7,
            tools: args.tools,
            tool_choice: args.tool_choice
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      }
    };
  } catch (error) {
    throw new Error(`Failed to initialize URL-based provider: ${error.message}`);
  }
}

// Initialize Groq provider using SDK
async function initializeGroqProvider(apiKey) {
  try {
    // Use Groq SDK
    const { Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: apiKey });

    console.log("🚀 Groq client initialized successfully");

    return {
      type: 'groq-sdk',
      client: groq,
      async chatCompletionsCreate(args) {
        return await groq.chat.completions.create({
          messages: args.messages,
          model: 'openai/gpt-oss-120b', // Always use this for Groq
          temperature: args.temperature || 0.7,
          max_completion_tokens: args.max_tokens || 8192,
          top_p: 1,
          stream: false,
          reasoning_effort: "medium"
        });
      }
    };
  } catch (error) {
    console.error("❌ Failed to initialize Groq client:", error.message);
    throw new Error(`Groq initialization failed: ${error.message}`);
  }
}

// Provider availability cache
let providerCache = { llm: null };

async function initializeProviders() {
  console.log("🔍 Initializing LLM providers...");

  // Check LLM provider availability
  providerCache.llm = !!llmClient;
  console.log(`✅ LLM Provider: ${providerCache.llm ? 'Available' : 'Unavailable'}`);
  if (providerCache.llm) {
    console.log(`📋 Provider Type: ${clientType}`);
  }

  console.log("🚀 Provider initialization complete!");
}

function getBestAvailableProvider() {
  return providerCache.llm ? 'llm' : null;
}

function markProviderFailed(provider) {
  if (providerCache[provider] !== null) {
    providerCache[provider] = false;
    console.log(`⚠️  Marked ${provider} as failed, will use next available provider`);
  }
}

export async function completeWithTools(args) {
  if (providerCache.llm === null) {
    await initializeProviders();
  }

  if (providerCache.llm && llmClient) {
    try {
      console.log(`🚀 Using ${clientType} LLM provider for tool completion`);

      if (clientType === 'groq-sdk') {
        // Groq SDK provider - always use openai/gpt-oss-120b
        return await llmClient.chatCompletionsCreate({
          ...args,
          model: 'openai/gpt-oss-120b', // Always use this for Groq
          max_tokens: args.max_tokens || 8192,
          temperature: args.temperature || 0.7
        });
      } else if (clientType === 'url+key') {
        // URL-based provider - use user's model name if provided
        return await llmClient.chatCompletionsCreate({
          ...args,
          model: args.model || "meta-llama/llama-3.1-8b-instruct",
          max_tokens: args.max_tokens || 4000,
          temperature: args.temperature || 0.7
        });
      }
    } catch (error) {
      console.log(`❌ LLM provider failed: ${error.message}`);
      markProviderFailed('llm');
      throw error;
    }
  }

  throw new Error("LLM provider not available. Please check your API key and settings.");
}

export async function generateText(prompt, model = null) {
  if (providerCache.llm === null) {
    await initializeProviders();
  }

  if (providerCache.llm && llmClient) {
    try {
      console.log(`🚀 Using ${clientType} LLM provider for text generation`);

      if (clientType === 'groq-sdk') {
        // Groq SDK provider - always use openai/gpt-oss-120b
        const completion = await llmClient.chatCompletionsCreate({
          messages: [{ role: "user", content: prompt }],
          model: 'openai/gpt-oss-120b', // Always use this for Groq
          max_tokens: 8192,
          temperature: 0.7
        });
        return completion.choices[0].message.content;
      } else if (clientType === 'url+key') {
        // URL-based provider - use user's model name if provided
        const completion = await llmClient.chatCompletionsCreate({
          messages: [{ role: "user", content: prompt }],
          model: model || "meta-llama/llama-3.1-8b-instruct",
          max_tokens: 2000,
          temperature: 0.7
        });
        return completion.choices[0].message.content;
      }
    } catch (error) {
      console.log(`❌ LLM provider failed: ${error.message}`);
      markProviderFailed('llm');
      throw error;
    }
  }

  throw new Error("LLM provider not available. Please check your API key and settings.");
}

export function getProviderStatus() {
  return {
    llm: providerCache.llm,
    clientType: clientType,
    bestAvailable: getBestAvailableProvider()
  };
}

export function resetProviderCache() {
  providerCache = { llm: null };
  console.log("🔄 Provider cache reset");
}