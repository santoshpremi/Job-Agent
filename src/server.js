import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { exportToText, exportToCSV, exportToExcel, exportToPDF } from './utils/fileExport.js';
import { searchJobs } from './tools/searchGoogle.js';
import { addTodos, markTodoDone, checkTodos } from './tools/todoList.js';
import { checkGoalDone } from './tools/llmJudge.js';
import { searchGoogle } from './tools/searchGoogle.js';
import { browseWeb } from './tools/browseWeb.js';
import { getProviderStatus, resetProviderCache, updateSettings } from './utils/ai.js';
import { updateSerpApiKey } from './tools/searchGoogle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// In-memory settings storage
let appSettings = {
  apiKey: '',                    // Single API key for any LLM provider
  serpApiKey: '',               // SerpAPI key (separate service)
  llmProviderUrl: '',           // URL for providers that need it (optional)
  providerType: 'auto',         // Auto-detect or specify: 'auto', 'url+key', 'key-only'
  modelName: 'openai/gpt-oss-120b',
  temperature: 0.7,
  maxTokens: 4096
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Store current jobs in memory
let currentJobs = [];

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    jobsInMemory: currentJobs.length
  });
});

// Get settings endpoint
app.get('/api/settings', (req, res) => {
  res.json({
    success: true,
    settings: appSettings
  });
});

// Update settings endpoint
app.post('/api/settings', async (req, res) => {
  try {
    const newSettings = req.body;

    // Validate required fields
    if (!newSettings.apiKey && !newSettings.serpApiKey) {
      return res.status(400).json({
        success: false,
        error: 'At least one API key (apiKey or serpApiKey) is required'
      });
    }

    // Update app settings
    appSettings = { ...appSettings, ...newSettings };

    // Update AI utilities with new settings
    await updateSettings(appSettings);

    // Update SerpAPI key
    updateSerpApiKey(appSettings.serpApiKey);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: appSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Provider status endpoint
app.get('/api/providers', (req, res) => {
  try {
    const status = getProviderStatus();
    res.json({
      success: true,
      providers: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Provider requirements endpoint - shows what each provider needs
app.get('/api/providers/requirements', (req, res) => {
  try {
    const requirements = {
      llmProvider: {
        name: "LLM Provider",
        needsUrl: "Auto-detect",
        needsApiKey: true,
        description: "Any LLM service (OpenAI, Groq, Anthropic, OpenRouter, etc.)",
        url: "Optional - only if provider needs it",
        status: appSettings.apiKey ? "Configured" : "Not Configured",
        type: appSettings.llmProviderUrl ? "URL + API Key" : "API Key Only"
      },
      serpapi: {
        name: "SerpAPI",
        needsUrl: false,
        needsApiKey: true,
        description: "Web search and job scraping service",
        status: appSettings.serpApiKey ? "Configured" : "Not Configured"
      }
    };

    res.json({
      success: true,
      requirements: requirements,
      currentSettings: {
        hasApiKey: !!appSettings.apiKey,
        hasUrl: !!appSettings.llmProviderUrl,
        hasSerpApiKey: !!appSettings.serpApiKey,
        providerType: appSettings.llmProviderUrl ? "URL + API Key" : "API Key Only"
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// LLM Provider Status endpoint - for frontend status display
app.get('/api/providers/status', (req, res) => {
  try {
    const status = getProviderStatus();

    // Check if LLM provider is available
    const llmAvailable = status.llm && status.llm.available;

    res.json({
      success: true,
      llm: {
        available: llmAvailable,
        status: llmAvailable ? "Available" : "Not Available",
        message: llmAvailable ? "LLM provider is working" : "LLM provider not available"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      llm: {
        available: false,
        status: "Error",
        message: "Failed to check LLM provider status"
      }
    });
  }
});

// Test LLM Provider endpoint - actually test if the provider works
app.post('/api/providers/test-llm', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
    }

    // Import the generateText function and test it
    const { generateText } = await import('./utils/ai.js');

    try {
      const response = await generateText(prompt, "openai/gpt-oss-120b");

      res.json({
        success: true,
        message: "LLM provider test successful",
        response: response.substring(0, 100) + "..." // Truncate for security
      });
    } catch (llmError) {
      res.status(500).json({
        success: false,
        error: "LLM provider test failed",
        details: llmError.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset provider cache endpoint
app.post('/api/providers/reset', (req, res) => {
  try {
    resetProviderCache();
    res.json({
      success: true,
      message: 'Provider cache reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced job search endpoint
app.post('/api/search-jobs', async (req, res) => {
  try {
    const { query, location, remote, count } = req.body;

    console.log(`🔍 Job search request: ${query} in ${location}, Remote: ${remote}, Count: ${count}`);

    // Use the enhanced job search with all tools
    const jobsJson = await searchJobs({
      query: query || 'Software Engineer',
      location: location || 'San Francisco, CA',
      remote: remote || false,
      count: count || 10
    });

    const jobs = JSON.parse(jobsJson);
    currentJobs = jobs;

    // Save to text file
    const filename = await exportToText(jobs);
    console.log(`📄 Results saved to: ${filename}`);

    res.json({
      success: true,
      jobs: jobs,
      count: jobs.length,
      filename: filename
    });

  } catch (error) {
    console.error('❌ Job search failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Tool endpoints for agent framework
app.post('/api/tools/add-todos', async (req, res) => {
  try {
    const { newTodos } = req.body;
    const result = await addTodos({ newTodos });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tools/mark-todo-done', async (req, res) => {
  try {
    const { todo } = req.body;
    const result = await markTodoDone({ todo });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tools/check-todos', async (req, res) => {
  try {
    const result = await checkTodos({});
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tools/check-goal-done', async (req, res) => {
  try {
    const { goal, answer } = req.body;
    const result = await checkGoalDone({ goal, answer });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tools/search-google', async (req, res) => {
  try {
    const { query } = req.body;
    const result = await searchGoogle({ query });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tools/browse-web', async (req, res) => {
  try {
    const { url } = req.body;
    const result = await browseWeb({ url });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export endpoints
app.post('/api/export/csv', async (req, res) => {
  try {
    const { jobs } = req.body;
    const csvBuffer = await exportToCSV(jobs);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="jobs_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/export/excel', async (req, res) => {
  try {
    const { jobs } = req.body;
    const excelBuffer = await exportToExcel(jobs);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="jobs_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/export/pdf', async (req, res) => {
  try {
    const { jobs } = req.body;
    const pdfBuffer = await exportToPDF(jobs);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="jobs_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// History endpoint to list all previous job searches
app.get('/api/history', (req, res) => {
  try {
    const downloadsDir = join(__dirname, '../public/downloads');

    if (!fs.existsSync(downloadsDir)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(downloadsDir)
      .filter(file => file.endsWith('.txt'))
      .map(file => {
        const filePath = join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          downloadUrl: `/downloads/${file}`,
          csvUrl: `/api/export/${encodeURIComponent(file)}/csv`,
          excelUrl: `/api/export/${encodeURIComponent(file)}/excel`,
          pdfUrl: `/api/export/${encodeURIComponent(file)}/pdf`
        };
      })
      .sort((a, b) => b.modified - a.modified); // Most recent first

    res.json({
      success: true,
      files: files
    });

  } catch (error) {
    console.error('❌ Error reading history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete history file endpoint
app.delete('/api/history/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const downloadsDir = join(__dirname, '../public/downloads');
    const filePath = join(downloadsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Delete the file
    fs.unlinkSync(filePath);

    console.log(`✅ Deleted history file: ${filename}`);
    res.json({
      success: true,
      message: `File ${filename} deleted successfully`
    });

  } catch (error) {
    console.error('❌ Error deleting history file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export endpoint for different formats
app.get('/api/export/:filename/:format', async (req, res) => {
  try {
    const { filename, format } = req.params;
    const filePath = join(__dirname, '../public/downloads', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Read the text file and parse job data
    const content = fs.readFileSync(filePath, 'utf8');
    const jobs = parseJobsFromText(content);

    let fileBuffer;
    let contentType;
    let downloadFilename;

    switch (format) {
      case 'csv':
        fileBuffer = await exportToCSV(jobs);
        contentType = 'text/csv';
        downloadFilename = filename.replace('.txt', '.csv');
        break;
      case 'excel':
        fileBuffer = await exportToExcel(jobs);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        downloadFilename = filename.replace('.txt', '.xlsx');
        break;
      case 'pdf':
        fileBuffer = await exportToPDF(jobs);
        contentType = 'application/pdf';
        downloadFilename = filename.replace('.txt', '.pdf');
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid format' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.send(fileBuffer);

  } catch (error) {
    console.error('❌ Error exporting file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to parse jobs from text file
function parseJobsFromText(content) {
  const jobs = [];
  const jobBlocks = content.split(/-{30}/);

  for (const block of jobBlocks) {
    if (block.trim().length === 0) continue;

    const job = {};
    const lines = block.split('\n');

    for (const line of lines) {
      if (line.includes('🏢 Company:')) {
        job.company = line.split('🏢 Company:')[1]?.trim() || 'N/A';
      } else if (line.includes('💼 Position:')) {
        job.jobTitle = line.split('💼 Position:')[1]?.trim() || 'N/A';
      } else if (line.includes('📍 Location:')) {
        job.companyAddress = line.split('📍 Location:')[1]?.trim() || 'N/A';
      } else if (line.includes('🌐 Work Type:')) {
        job.remoteOnsite = line.split('🌐 Work Type:')[1]?.trim() || 'N/A';
      } else if (line.includes('💻 Technologies:')) {
        job.languageRequirements = line.split('💻 Technologies:')[1]?.trim() || 'N/A';
      } else if (line.includes('📅 Posted:')) {
        job.postedDate = line.split('📅 Posted:')[1]?.trim() || 'N/A';
      } else if (line.includes('💰 Salary:')) {
        job.salary = line.split('💰 Salary:')[1]?.trim() || 'N/A';
      } else if (line.includes('📋 Requirements:')) {
        job.requirements = line.split('📋 Requirements:')[1]?.trim() || 'N/A';
      } else if (line.includes('🎁 Benefits:')) {
        job.benefits = line.split('🎁 Benefits:')[1]?.trim() || 'N/A';
      } else if (line.includes('🔗 URL:')) {
        job.url = line.split('🔗 URL:')[1]?.trim() || 'N/A';
      }
    }

    if (Object.keys(job).length > 0) {
      jobs.push(job);
    }
  }

  return jobs;
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Job Agent Server running on http://localhost:${PORT}`);
  console.log(`📋 Available tools: addTodos, markTodoDone, checkTodos, checkGoalDone, searchGoogle, browseWeb, enhancedSearchJobs`);
  console.log(`🔑 API Key System: Single key for LLM providers + separate SerpAPI key`);
  console.log(`🌐 Smart Provider Detection: Automatically detects URL requirements`);
});
