// Step 2: Tool Calling and Integration System
// This demonstrates how the agent system uses tools to accomplish tasks
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod';
import { completeWithTools } from '../utils/ai.js';
import { searchGoogle, searchGoogleToolConfig } from '../tools/searchGoogle.js';
import { addTodos, addTodosToolConfig } from '../tools/todoList.js';
import { checkGoalDone } from '../tools/llmJudge.js';

const prompt = "I want to buy a hoodie with a fur lined hood. It needs a full zipper. Near Times Square in NYC. Where can I buy one today at lunch time?"

const doneResponseSchema = z.object({
  done: z.boolean(),
});

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 STEP 2: Tool Calling and Integration System");
  console.log("=".repeat(60));
  
  console.log("\n📋 This step demonstrates:");
  console.log("1. How tools are defined and configured");
  console.log("2. Tool calling with LLM agents");
  console.log("3. Integration between different tools");
  console.log("4. Structured tool execution workflow");
  
  console.log("\n" + "#".repeat(40));
  console.log(`Question: ${prompt}`);

  try {
    // Use the agent system with tool calling
    const completion = await completeWithTools({
      messages: [{ role: "developer", content: prompt }],
      model: "gpt-4o",
      tool_choice: "auto",
      tools: [searchGoogleToolConfig, addTodosToolConfig],
      store: false
    });

    const answer = completion.choices[0].message.content;
    console.log("\n" + "#".repeat(40));
    console.log(`Agent Response: ${answer}`);

    // Validate the response using the LLM judge
    console.log("\n🔍 Validating Response with LLM Judge:");
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
    console.log("\n❌ Tool calling failed:", error.message);
    console.log("💡 This demonstrates the fallback system when LLM providers fail");
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("🎯 Key Learning Points:");
  console.log("• Tools are defined with Zod schemas for validation");
  console.log("• The agent can automatically choose which tools to use");
  console.log("• Tool calling integrates with the smart LLM fallback system");
  console.log("• This creates a powerful, tool-using agent architecture");
  console.log("=".repeat(60));
}

main();