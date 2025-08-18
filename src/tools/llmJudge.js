import { z } from 'zod'
import { completeWithTools } from '../utils/ai.js'

const prompt = `
You are research assistant who reads requests and answers.
You determine if the answer satisfies the request.
If it does you respond that the request is done.
If not you give specific feedback on what is missing in the form of actionable individual todos.
`

// ####################################################################################
// CREATE - Add New Todos
export async function checkGoalDone({goal, answer}) {
  try {
    const resp = await completeWithTools({
      model: "gpt-4o",
      messages: [{
        role: "developer",
        content: prompt
      },{
          role: "user",
          content: `## Request: ${goal}\n\n## Answer: ${answer}`,
      }],
      response_format: {
        type: "json_object"
      }
    })
    
    const check = JSON.parse(resp.choices[0].message.content)
    console.log("\n\n"+"#".repeat(40));
    console.log(`LLM as judge: ${ check.done ? "👍":"👎"}`)
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
