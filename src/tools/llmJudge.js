import { z } from 'zod'
import { completeWithTools } from '../utils/ai.js'

const prompt = `
You are a research assistant who evaluates if answers satisfy requests.
You must respond with ONLY valid JSON in this exact format:
{
  "done": true/false,
  "feedback": ["specific actionable feedback item 1", "specific actionable feedback item 2"]
}

Rules:
1. Respond with ONLY the JSON object, no markdown, no extra text
2. "done" must be true if the answer fully satisfies the request, false otherwise
3. "feedback" must be an array of specific, actionable items
4. If done is true, feedback can be empty array []
5. If done is false, feedback must contain specific things missing
`

// ####################################################################################
// CREATE - Add New Todos
export async function checkGoalDone({ goal, answer }) {
  try {
    const resp = await completeWithTools({
      model: "openai/gpt-oss-120b",  // Use Groq's preferred model
      messages: [{
        role: "developer",
        content: prompt
      }, {
        role: "user",
        content: `## Request: ${goal}\n\n## Answer: ${answer}`,
      }],
      response_format: {
        type: "json_object"
      }
    })

    let content = resp.choices[0].message.content.trim();

    // Try to extract JSON from the response if it contains markdown
    if (content.includes('```json')) {
      content = content.split('```json')[1]?.split('```')[0] || content;
    } else if (content.includes('```')) {
      content = content.split('```')[1]?.split('```')[0] || content;
    }

    // Clean up any remaining markdown or extra text
    content = content.replace(/^\s*```\s*/, '').replace(/\s*```\s*$/, '');
    content = content.trim();

    const check = JSON.parse(content);
    console.log("\n\n" + "#".repeat(40));
    console.log(`LLM as judge: ${check.done ? "👍" : "👎"}`);
    return JSON.stringify(check)

  } catch (error) {
    console.error("❌ Error in checkGoalDone:", error.message);
    // Return a fallback response if LLM fails
    return JSON.stringify({
      done: false,
      feedback: ["LLM evaluation failed. Please manually review the results."]
    });
  }
}

// Tool configuration for LLM integration
export const checkGoalDoneToolConfig = {
  name: "checkGoalDone",
  description: "Check if the answer successfully meets the requested goal.",
  parameters: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description: "The requested goal to be completed."
      },
      answer: {
        type: "string",
        description: "The answer that will be provided to the requesting party to complete that goal."
      }
    },
    required: ["goal", "answer"]
  }
}
