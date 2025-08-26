# Job Agent

AI-powered job search agent using advanced agent architecture with planning, tools, and intelligent execution. Built with Node.js, Express, and modern AI providers.

![Job Agent Interface](/public/assets/homepage.png)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the web interface
npm start

# Open http://localhost:3000 in your browser
# Go to Settings panel and enter your API keys:
# - SerpAPI Key for job search
# - OpenRouter API Key for LLM access
# - Groq API Key (optional, as fallback)
```

## ✨ Features

- 🤖 **Intelligent Agent Architecture**: Uses `_steps` and `tools` pattern for structured job searching
- 🔍 **Advanced Web Search**: SerpAPI integration with intelligent filtering
- 📊 **Smart Data Extraction**: AI-powered job information parsing with quality control
- 🎯 **Content Filtering**: Automatically excludes non-job content (Reddit, Quora, etc.)
- 📁 **Multiple Export Formats**: TXT, CSV, Excel, PDF with clean filenames
- 🌐 **Professional Web Interface**: Modern UI with real-time workflow visualization
- 📋 **Search History**: View and download previous job searches
- 🔄 **LLM Fallback System**: OpenRouter → Groq with intelligent provider switching

## 🛠️ Available Tools

- **`searchGoogle`** - SerpAPI-powered job search with intelligent filtering
- **`browseWeb`** - Web scraping tool for detailed job page analysis
- **`addTodos`** - Task management for job search workflow
- **`markTodoDone`** - Progress tracking
- **`checkTodos`** - View current tasks
- **`checkGoalDone`** - LLM-powered goal completion validation
- **`searchJobs`** - Comprehensive job search orchestration

## 🏗️ Project Structure

```
src/
├── _steps/          # Agent workflow steps
│   ├── step0-llm.js        # LLM integration demo
│   ├── step1-condition.js  # Conditional logic demo
│   ├── step2-tool.js       # Tool usage demo
│   ├── step3-refactor.js   # Code refactoring demo
│   └── step4-planning.js   # Planning and execution demo
├── tools/           # Available tools
│   ├── searchGoogle.js     # Job search with SerpAPI
│   ├── browseWeb.js        # Web scraping tool
│   ├── todoList.js         # Task management
│   ├── llmJudge.js         # Goal validation
│   └── index.js            # Tool registry
├── utils/           # Utilities
│   ├── ai.js               # LLM provider management
│   └── fileExport.js       # Export functionality
└── server.js        # Express web server
```

## 🔧 Configuration

The application no longer requires a `.env` file. All configuration is done through the web interface:

1. **Start the application**: `npm start`
2. **Open the web interface**: http://localhost:3000
3. **Go to Settings panel** (right sidebar)
4. **Enter your API keys**:
   - **SerpAPI Key**: Required for job search functionality
   - **OpenRouter API Key**: Required for LLM access
   - **Groq API Key**: Optional, used as fallback if OpenRouter fails
5. **Click "Save Settings"** to apply changes

**Note**: Settings are stored in memory and will reset when the server restarts.

## 🎯 How It Works

1. **Planning Phase**: Agent creates a structured plan for job search
2. **Search Execution**: Uses SerpAPI to find relevant job postings
3. **Content Filtering**: Intelligently filters out non-job content
4. **Data Extraction**: Parses job information with AI assistance
5. **Quality Control**: Validates results and excludes low-quality data
6. **Export & Storage**: Saves results in multiple formats with clean filenames

## 📊 Data Quality Features

- **Smart Filtering**: Excludes social media, advice sites, and aggregator pages
- **Content Analysis**: Detects and filters non-job content patterns
- **Company Mapping**: Maps job sites to readable company names
- **Location Extraction**: Intelligent location parsing from titles and snippets
- **Clean Filenames**: Generates short, meaningful filenames (e.g., `software_engineer_2025-08-18.txt`)

## 🌐 Web Interface

- **Search Configuration**: Job title, location, remote preference, count
- **Real-time Workflow**: Visual agent progress tracking
- **Results Display**: Clean table format with job details
- **Search History**: View and download previous searches
- **Export Options**: Direct download in CSV, Excel, PDF formats

## 🚀 Usage Examples

```bash
# Start the web interface
npm start

# Access the interface at http://localhost:3000

# Use the search form to find jobs:
# - Job Title: "Software Engineer"
# - Location: "San Francisco, CA"
# - Remote: Yes/No
# - Count: Number of jobs to find
```

## 🔍 Supported Job Sites

- LinkedIn, Indeed, Glassdoor, Monster
- CareerBuilder, ZipRecruiter, SimplyHired
- Dice, Built In SF, AngelList
- GitHub, Stack Overflow, Amazon Jobs
- German sites: Hays, EnglishJobs, GermanTechJobs
- And many more...

## 📝 License

MIT
