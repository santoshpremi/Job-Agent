// Step 0: LLM Integration and Smart Fallback System
// This demonstrates how the agent system integrates with multiple LLM providers
import { generateText, getProviderStatus } from '../utils/ai.js';

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 STEP 0: LLM Integration and Smart Fallback System");
  console.log("=".repeat(60));
  
  console.log("\n📋 This step demonstrates:");
  console.log("1. How LLM providers are automatically detected");
  console.log("2. Smart provider type detection (URL+Key vs Key-only)");
  console.log("3. Provider availability caching");
  console.log("4. Automatic model selection for best performance");
  
  // Check provider status
  console.log("\n🔍 Checking LLM Provider Status:");
  const status = getProviderStatus();
  console.log("LLM Provider:", status.llm ? "✅ Available" : "❌ Unavailable");
  if (status.llm) {
    console.log("Provider Type:", status.clientType || "Unknown");
  }
  console.log("Best Available:", status.bestAvailable || "None");
  
  // Test text generation with smart fallback
  console.log("\n🧪 Testing Text Generation with Smart Fallback:");
  const testPrompt = "Explain in one sentence how AI agents work.";
  
  try {
    console.log(`\n📝 Prompt: "${testPrompt}"`);
    const response = await generateText(testPrompt);
    console.log(`🤖 Response: ${response}`);
    console.log("✅ Text generation successful!");
  } catch (error) {
    console.log(`❌ Text generation failed: ${error.message}`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("🎯 Key Learning Points:");
  console.log("• The system automatically selects the best available LLM provider");
  console.log("• Failed providers are marked and skipped in future calls");
  console.log("• No repeated availability checks - efficient and cost-effective");
  console.log("• Easy to add new providers to the fallback chain");
  console.log("=".repeat(60));
}

main();