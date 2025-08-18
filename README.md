# Job Agent

AI-powered job search using agent architecture with planning, tools, and execution.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run Job Agent
npm run step5

# Start web interface
npm start
```

## Features

- 🤖 **Agent Architecture**: Uses `_steps` and `tools` pattern
- 🔍 **Web Search**: SerpAPI integration for job discovery
- 📊 **Data Extraction**: AI-powered job information parsing
- 📁 **Export Options**: TXT, CSV, Excel, PDF formats
- 🌐 **Web Interface**: Beautiful UI with workflow visualization

## Steps to Talk

```bash
npm run step0    # LLM integration
npm run step1    # Conditional logic
npm run step2    # Tool usage
npm run step3    # Code refactoring
npm run step4    # Planning and execution
npm run step5    # Job Agent (main)
```

## Environment Variables

```bash
OPENAI_API_KEY=your_openai_key
SERP_API_KEY=your_serpapi_key
OPENROUTER_API_KEY=your_openrouter_key
PORT=3000
```

## Project Structure

```
src/
├── _steps/          # Agent workflow steps
├── tools/           # Available tools
├── utils/           # Utilities (AI, file export)
└── server.js        # Web server
```

## License

MIT
