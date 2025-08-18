import { z } from "zod";

let todos = []
const done = []

// ####################################################################################
// CREATE - Add New Todos
export function addTodos({newTodos}) {
    todos.push(...newTodos)
    const delim = '\n  - '
    console.log(`Todo list:${delim}${todos.join(delim)}`)
    return `Added ${newTodos.length} to todo list. Now have ${todos.length} todos.`
}

// Tool configuration for LLM integration
export const addTodosToolConfig = {
    name: "addTodos",
    description: "Add an array of todos to my todo list.",
    parameters: {
        type: "object",
        properties: {
            newTodos: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "The array of new todos to add to my todo list."
            }
        },
        required: ["newTodos"]
    }
}

// ####################################################################################
// Mark Todos Done
export function markTodoDone({todo}) {
    if (todos.includes(todo)) {
        todos = todos.filter(item => item !== todo)
        done.push(todo)
        return `Marked the following todo as done:\n  ${todo}`
    } else {
        return `Todo list doesn't include todo:\n  ${todo}`
    }
}

export const markTodoDoneToolConfig = {
    name: "markTodoDone",
    description: "Mark an individual item on my todo list as done.",
    parameters: {
        type: "object",
        properties: {
            todo: {
                type: "string",
                description: "The todo item to mark as done."
            }
        },
        required: ["todo"]
    }
}

// ####################################################################################
// Read the done list
export function checkDoneTodos({}) {
    if (done.length > 0) {
        return JSON.stringify(done)
    } else {
        return "No tasks have been marked done."
    }
}

export const checkDoneTasksToolConfig = {
    name: "checkDoneTasks",
    description: "Read everything on the todo list that has been marked done.",
    parameters: {
        type: "object",
        properties: {},
        required: []
    }
}

// ####################################################################################
// Read the todo list
export function checkTodos({}) {
    if (todos.length > 0) {
        return JSON.stringify(todos)
    } else {
        return "The todo list is empty."
    }
}

export const checkTodosToolConfig = {
    name: "checkTodos",
    description: "Read everything on the todo list.",
    parameters: {
        type: "object",
        properties: {},
        required: []
    }
}
