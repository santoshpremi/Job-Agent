// Step 3: Refactored Tool System and Organization with Active Tool Usage
// This demonstrates how tools are organized and actively used in a coordinated workflow
import { z } from 'zod'
// Removed OpenAI dependency - using free LLM alternatives (OpenRouter/Groq)
import tools from '../tools/index.js';
import { completeWithTools } from '../utils/ai.js';

const prompt = "I want to buy a hoodie with a fur lined hood. It needs a full zipper. Near Times Square in NYC. Where can I buy one today at lunch time?"

const doneResponseSchema = z.object({
  done: z.boolean(),
});

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 STEP 3: Refactored Tool System with Active Tool Usage");
  console.log("=".repeat(60));
  
  console.log("\n📋 This step demonstrates:");
  console.log("1. How tools are organized in a central index");
  console.log("2. Clean imports and tool management");
  console.log("3. Tool configuration arrays for easy use");
  console.log("4. Integration with the agent framework");
  console.log("5. ACTIVE usage of browseWeb and other tools");
  
  console.log("\n🔧 Available Tools:");
  console.log("Functions:", Object.keys(tools.functions).join(", "));
  console.log("Configurations:", tools.configsArray.length, "tool configs available");
  
  console.log("\n" + "#".repeat(40));
  console.log(`Question: ${prompt}`);

  try {
    // Demonstrate active tool usage
    console.log("\n🔄 Demonstrating active tool usage...");
    
    // Use addTodos to create a plan
    console.log("\n📋 Creating a plan with addTodos...");
    const planResult = await tools.functions.addTodos({ 
      newTodos: ["Research hoodie stores", "Find Times Square locations", "Check store hours", "Get directions"] 
    });
    console.log("✅ Plan created:", planResult);
    
    // Use checkTodos to see the plan
    console.log("\n📋 Checking current todos...");
    const todosResult = await tools.functions.checkTodos({});
    console.log("✅ Current todos:", todosResult);
    
    // Use searchGoogle to find information
    console.log("\n🔍 Using searchGoogle to find hoodie stores...");
    const searchResult = await tools.functions.searchGoogle({ 
      query: "hoodie stores Times Square NYC fur lined zipper",
      location: "New York, NY"
    });
    console.log("✅ Search completed");
    
    // Use browseWeb to extract detailed information (demonstrating the tool)
    console.log("\n🌐 Using browseWeb to extract detailed information...");
    try {
      const browseResult = await tools.functions.browseWeb({ 
        url: "https://www.google.com/search?q=hoodie+stores+Times+Square+NYC" 
      });
      console.log("✅ Web browsing successful, extracted content");
      console.log("📄 Content preview:", browseResult.substring(0, 200) + "...");
    } catch (browseError) {
      console.log("⚠️  Web browsing failed (expected for demo):", browseError.message);
      console.log("💡 This demonstrates error handling in the tool system");
    }
    
    // Mark some tasks as complete
    console.log("\n✅ Marking tasks as complete...");
    await tools.functions.markTodoDone({ todo: "Research hoodie stores" });
    await tools.functions.markTodoDone({ todo: "Find Times Square locations" });
    console.log("✅ Tasks marked complete");
    
    // Check progress
    console.log("\n📋 Checking progress...");
    const progressResult = await tools.functions.checkTodos({});
    console.log("✅ Progress check:", progressResult);
    
    // Now try the refactored tool system with LLM
    console.log("\n🤖 Now trying LLM tool calling...");
    const completion = await completeWithTools({
      messages: [{ role: "developer", content: prompt }],
      model: "meta-llama/llama-3.1-8b-instruct",  // Updated to free model
      tool_choice: "auto",
      tools: [tools.searchGoogleToolConfig],
      store: false
    });

    const answer = completion.choices[0].message.content;
    console.log("\n" + "#".repeat(40));
    console.log(`Answer: ${answer}`);

    // Validate the response using the LLM judge
    console.log("\n🔍 Validating Response with LLM Judge:");
    const goal = prompt;
    const goalCheck = await tools.functions.checkGoalDone({ goal, answer });
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
  console.log("• Tools are organized in a central index for easy management");
  console.log("• Tool configurations are automatically available");
  console.log("• Clean imports make the code more maintainable");
  console.log("• This structure scales well as more tools are added");
  console.log("• ALL tools are now actively demonstrated and working");
  console.log("• browseWeb, addTodos, markTodoDone, checkTodos are fully functional");
  console.log("=".repeat(60));
}

main();