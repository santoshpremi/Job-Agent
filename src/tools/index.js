import { searchGoogle, searchGoogleToolConfig, searchJobs, searchJobsToolConfig } from "./searchGoogle.js";
import { markTodoDone, markTodoDoneToolConfig,
        addTodos, addTodosToolConfig,
        checkTodos, checkTodosToolConfig
     } from "./todoList.js";
import { checkGoalDone, checkGoalDoneToolConfig } from "./llmJudge.js";
import { browseWeb, browseWebToolConfig } from "./browseWeb.js";

export const functions = {
    searchGoogle,
    addTodos,
    markTodoDone,
    checkTodos,
    checkGoalDone,
    browseWeb,
    searchJobs
}

export const configsArray = [
    searchGoogleToolConfig,
    addTodosToolConfig,
    markTodoDoneToolConfig,
    checkTodosToolConfig,
    checkGoalDoneToolConfig,
    browseWebToolConfig,
    searchJobsToolConfig
]

export default {
    searchGoogle,
    searchGoogleToolConfig,
    functions,
    configsArray
}