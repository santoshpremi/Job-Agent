// Step 1: LLM as Judge - Response Validation System
// This demonstrates how the agent system validates responses using LLM judgment
import { z } from 'zod'
// Removed OpenAI dependency - using free LLM alternatives (OpenRouter/Groq)
import { generateText } from '../utils/ai.js';
import { checkGoalDone } from '../tools/llmJudge.js';

const prompt = "What is the average wing speed of a swallow?"

const doneResponseSchema = z.object({
  done: z.boolean(),
});

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 STEP 1: LLM as Judge - Response Validation System");
  console.log("=".repeat(60));
  
  console.log("\n📋 This step demonstrates:");
  console.log("1. How LLMs can act as judges to validate responses");
  console.log("2. Structured response validation using Zod schemas");
  console.log("3. Goal completion checking system");
  console.log("4. Integration with the agent's validation tools");
  
  console.log("\n" + "#".repeat(40));
  console.log(`Question: ${prompt}`);

  try {
    // Use the smart LLM fallback system to get an answer
    const answer = await generateText(prompt);
    console.log("\n" + "#".repeat(40));
    console.log(`Answer: ${answer}`);

    // Use the LLM judge to validate the response
    console.log("\n🔍 Using LLM as Judge to Validate Response:");
    const goal = prompt;
    const goalCheck = await checkGoalDone({ goal, answer });
    console.log("\n" + "#".repeat(40));
    console.log(`LLM as judge: ${JSON.parse(goalCheck).done ? "👍":"👎"}`);
    
    if (!JSON.parse(goalCheck).done) {
      console.log("📝 Feedback for improvement:");
      const feedback = JSON.parse(goalCheck).feedback;
      feedback.forEach((item, index) => {
        console.log(`${index + 1}. ${item}`);
      });
    }
    
  } catch (error) {
    console.log("\n❌ Error during validation:", error.message);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("🎯 Key Learning Points:");
  console.log("• LLMs can validate their own responses using structured schemas");
  console.log("• The checkGoalDone tool provides actionable feedback");
  console.log("• This creates a self-improving agent system");
  console.log("• Integration with the smart LLM fallback system");
  console.log("=".repeat(60));
}

main();