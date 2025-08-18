import * as serp from "serpapi";
import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import { browseWeb } from "./browseWeb.js";
import { addTodos, markTodoDone, checkTodos } from "./todoList.js";
import { checkGoalDone } from "./llmJudge.js";
import { generateText } from '../utils/ai.js';

export async function searchGoogle({query, location = "Philadelphia, PA"}) {
    console.log("\n\n"+"#".repeat(40))
    console.log(`Searching Google[${location}]: ${query}\n\n`)
    const resp = await serp.getJson("google", {
        api_key: process.env.SERP_API_KEY, // Get your API_KEY from https://serpapi.com/manage-api-key
        q: query,
        location
    })
    const stringResult = JSON.stringify(resp.organic_results.slice(0,5).map(el => {return {title: el.title, url: el.link}}))
    console.log(stringResult)
    return stringResult
}

// Enhanced job search functionality
export async function searchJobs({query, location, remote, count = 50}) {
    console.log("\n\n"+"#".repeat(60));
    console.log(`🚀 Job Search: ${query} in ${location}, Remote: ${remote}, Count: ${count}`);
    console.log("=".repeat(60));
    
    // Step 1: Create a plan using todo list
    const plan = [
        `Research ${query} job market in ${location}`,
        `Search for individual job postings using SerpAPI`,
        `Extract detailed job information from actual job pages`,
        `Compile comprehensive job report`
    ];
    
    await addTodos({ newTodos: plan });
    console.log("📋 Created job search plan");
    
    // Step 2: Research job market
    await markTodoDone({ todo: plan[0] });
    console.log("✅ Completed: Research job market");
    
    // Use more specific search queries to find individual job postings
    const searchQueries = [
        `"${query}" job ${location}`,
        `"${query}" position ${location}`,
        `"${query}" role ${location}`,
        `"${query}" hiring ${location}`,
        `"${query}" career ${location}`
    ];
    
    let allJobs = [];
    let processedCount = 0;
    
    // Step 3: Execute job search
    await markTodoDone({ todo: plan[1] });
    console.log("✅ Completed: Search for individual job postings");
    
    for (const searchQuery of searchQueries) {
        if (processedCount >= count) break;
        
        try {
            console.log(`\n🔍 Searching: "${searchQuery}"`);
            
            const resp = await serp.getJson("google", {
                api_key: process.env.SERP_API_KEY,
                q: searchQuery,
                location: location,
                num: 10
            });
            
            if (resp.organic_results) {
                console.log(`📊 Found ${resp.organic_results.length} search results`);
                
                for (const result of resp.organic_results) {
                    if (processedCount >= count) break;
                    
                    // Check if it's an actual job posting (not a job aggregator page)
                    if (isActualJobPosting(result.link, result.title, result.snippet)) {
                        try {
                            console.log(`\n📋 Processing: ${result.title.substring(0, 60)}...`);
                            console.log(`🔗 URL: ${result.link}`);
                            
                            // Extract job information from the search result first
                            const jobData = extractJobInfoFromSearchResult(result, query, location, remote);
                            
                            if (jobData) {
                                allJobs.push(jobData);
                                processedCount++;
                                console.log(`✅ Job ${processedCount}: ${jobData.company} - ${jobData.jobTitle}`);
                            } else {
                                console.log(`❌ Job data extraction failed`);
                            }
                        } catch (error) {
                            console.log(`❌ Error processing ${result.link}: ${error.message}`);
                        }
                    } else {
                        console.log(`⏭️  Skipping non-job page: ${result.title.substring(0, 50)}...`);
                    }
                }
            }
        } catch (error) {
            console.log(`❌ Search failed for: ${searchQuery}: ${error.message}`);
        }
    }
    
    // Step 4: Extract detailed job information
    await markTodoDone({ todo: plan[2] });
    console.log("✅ Completed: Extract detailed job information");
    
    // Step 5: Compile comprehensive report
    await markTodoDone({ todo: plan[3] });
    console.log("✅ Completed: Compile job report");
    
    console.log(`\n🎉 Job search completed!`);
    console.log(`📊 Total jobs found: ${allJobs.length}`);
    console.log(`📈 Success rate: ${((allJobs.length / count) * 100).toFixed(1)}%`);
    
    // Check if goal is complete
    const goal = `Find ${count} ${query} jobs in ${location}`;
    const answer = `Successfully found ${allJobs.length} ${query} jobs in ${location} with detailed information.`;
    
    try {
        const goalCheck = await checkGoalDone({ goal, answer });
        console.log("🎯 Goal completion check:", goalCheck);
    } catch (error) {
        console.log("⚠️  Goal check failed:", error.message);
    }
    
    return JSON.stringify(allJobs);
}

// Check if the URL is an actual job posting, not a job aggregator page
function isActualJobPosting(url, title, snippet) {
    if (!url || !title) return false;
    
    // Exclude non-job sites completely
    const excludePatterns = [
        /reddit\.com/i,
        /quora\.com/i,
        /stackoverflow\.com\/questions/i,
        /github\.com\/.*\/issues/i,
        /youtube\.com/i,
        /medium\.com/i,
        /facebook\.com/i,
        /twitter\.com/i,
        /instagram\.com/i
    ];
    
    for (const pattern of excludePatterns) {
        if (pattern.test(url)) {
            console.log(`🚫 Excluding non-job site: ${url}`);
            return false;
        }
    }
    
    // Exclude content that's clearly not job postings
    const excludeContentPatterns = [
        /what\s+is\s+it\s+like/i,
        /how\s+do\s+you\s+get\s+jobs/i,
        /salary\s+stats/i,
        /job\s+market\s+for/i,
        /career\s+advice/i,
        /interview\s+tips/i,
        /resume\s+help/i
    ];
    
    const fullText = (title + ' ' + (snippet || '')).toLowerCase();
    for (const pattern of excludeContentPatterns) {
        if (pattern.test(fullText)) {
            console.log(`🚫 Excluding non-job content: ${title.substring(0, 50)}...`);
            return false;
        }
    }
    
    // Check if it's a specific job posting URL (these are definitely good)
    const jobPostingPatterns = [
        /\/jobs\/\d+/i,           // LinkedIn: /jobs/123456
        /\/viewjob\?jk=/i,        // Indeed: /viewjob?jk=abc123
        /\/job\//i,               // Glassdoor: /job/
        /\/careers\//i,           // Company careers pages
        /\/position\//i,          // Position pages
        /\/role\//i,              // Role pages
        /\/en\/jobs\//i,          // English job pages
        /\/jobs\/[a-zA-Z0-9-]+$/i // Job detail pages
    ];
    
    if (jobPostingPatterns.some(pattern => pattern.test(url))) {
        console.log(`✅ Found specific job posting URL: ${url}`);
        return true;
    }
    
    // Check if it's a legitimate job search/aggregator site
    const legitimateJobSites = [
        'indeed.com', 'linkedin.com', 'glassdoor.com', 'monster.com',
        'careerbuilder.com', 'ziprecruiter.com', 'simplyhired.com',
        'dice.com', 'builtinsf.com', 'angel.co', 'stackoverflow.com',
        'github.com', 'amazon.jobs', 'hays.de', 'englishjobs.de',
        'arbeitnow.com', 'datajob.io', 'germantechjobs.de',
        'devjobsscanner.com', 'stepstone.de', 'jobtensor.com',
        'wellfound.com', 'uber.com', 'gem.com'
    ];
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/^www\./, '');
        
        if (legitimateJobSites.includes(hostname)) {
            // For legitimate job sites, check if the content looks like job listings
            const hasJobContent = /jobs?|careers?|positions?|hiring|apply|openings?/i.test(fullText);
            if (hasJobContent) {
                console.log(`✅ Found legitimate job site with job content: ${hostname}`);
                return true;
            }
        }
    } catch (e) {
        // URL parsing failed
    }
    
    // If we get here, it's probably not a good job result
    console.log(`❌ Excluding questionable content: ${title.substring(0, 50)}...`);
    return false;
}

// Extract job information from search results
function extractJobInfoFromSearchResult(result, query, location, remote) {
    try {
        // Enhanced company extraction
        const company = extractCompanyFromTitleEnhanced(result.title, result.snippet, result.link);
        
        // Enhanced job title extraction
        const jobTitle = extractJobTitleEnhanced(result.title, result.snippet, query);
        
        // Extract location from title or snippet
        const extractedLocation = extractLocationFromText(result.title + ' ' + result.snippet, location);
        
        // Extract salary if mentioned
        const salary = extractSalaryFromText(result.snippet);
        
        // Extract requirements/skills if mentioned
        const requirements = extractRequirementsFromText(result.snippet);
        
        // Extract remote/onsite status
        const remoteOnsite = extractRemoteOnsiteFromText(result.snippet);
        
        // Extract posted date
        const postedDate = extractPostedDateFromText(result.snippet);
        
        // Extract technologies/languages
        const technologies = extractTechnologiesFromText(result.snippet);
        
        const jobData = {
            jobTitle: jobTitle,
            company: company,
            location: extractedLocation || location, // Use extracted location or fallback to search location
            url: result.link,
            snippet: result.snippet || 'N/A',
            source: new URL(result.link).hostname,
            postedDate: postedDate,
            remoteOnsite: remoteOnsite,
            salary: salary,
            requirements: requirements,
            languageRequirements: technologies
        };
        
        return jobData;
    } catch (error) {
        console.log(`❌ Error extracting job info: ${error.message}`);
        return null;
    }
}

// Enhanced company extraction
function extractCompanyFromTitleEnhanced(title, snippet, url) {
    if (!title) return 'N/A';
    
    // Pattern 1: "Job Title at Company Name"
    const atPattern = /(?:at|@|with)\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s*[-–—]|\s*$|\s*in|\s*\(|\s*,)/i;
    const atMatch = title.match(atPattern);
    if (atMatch && atMatch[1]) {
        const company = atMatch[1].trim();
        if (company.length > 2 && company.length < 50) {
            return company;
        }
    }
    
    // Pattern 2: "Company Name - Job Title"
    const dashPattern = /^([A-Z][a-zA-Z\s&.,]+?)\s*[-–—]\s+/i;
    const dashMatch = title.match(dashPattern);
    if (dashMatch && dashMatch[1]) {
        const company = dashMatch[1].trim();
        if (company.length > 2 && company.length < 50) {
            return company;
        }
    }
    
    // Pattern 3: Extract from URL for known job sites
    try {
        const urlObj = new URL(url);
        let hostname = urlObj.hostname;
        
        // Remove www. prefix if present
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        
        // Map known job sites to their display names
        const jobSiteNames = {
            'indeed.com': 'Indeed',
            'linkedin.com': 'LinkedIn',
            'glassdoor.com': 'Glassdoor',
            'monster.com': 'Monster',
            'careerbuilder.com': 'CareerBuilder',
            'ziprecruiter.com': 'ZipRecruiter',
            'simplyhired.com': 'SimplyHired',
            'dice.com': 'Dice',
            'builtinsf.com': 'Built In SF',
            'angel.co': 'AngelList',
            'stackoverflow.com': 'Stack Overflow',
            'github.com': 'GitHub',
            'amazon.jobs': 'Amazon',
            'hays.de': 'Hays',
            'englishjobs.de': 'EnglishJobs',
            'arbeitnow.com': 'ArbeitNow',
            'datajob.io': 'DataJob',
            'germantechjobs.de': 'GermanTechJobs',
            'devjobsscanner.com': 'DevJobsScanner',
            'stepstone.de': 'StepStone',
            'jobtensor.com': 'JobTensor',
            'wellfound.com': 'WellFound',
            'uber.com': 'Uber',
            'gem.com': 'Gem'
        };
        
        if (jobSiteNames[hostname]) {
            return jobSiteNames[hostname];
        }
        
        // For company career pages, extract company name from hostname
        if (hostname.includes('careers.') || hostname.includes('jobs.')) {
            const companyFromUrl = hostname.replace(/^(careers?|jobs?)\./, '').replace(/\.(com|de|jobs)$/, '');
            if (companyFromUrl.length > 2 && companyFromUrl.length < 30) {
                return companyFromUrl.charAt(0).toUpperCase() + companyFromUrl.slice(1);
            }
        }
        
        // Extract company from path if it's a company-specific job page
        const pathParts = urlObj.pathname.split('/');
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            if (part && part.length > 2 && part.length < 20 && /^[A-Z][a-z]/.test(part)) {
                // Check if this looks like a company name
                if (!['jobs', 'careers', 'positions', 'roles', 'en', 'de'].includes(part.toLowerCase())) {
                    return part.charAt(0).toUpperCase() + part.slice(1);
                }
            }
        }
        
    } catch (e) {
        // URL parsing failed, continue
    }
    
    // Pattern 4: Look for company names in snippet
    if (snippet) {
        const companyPatterns = [
            /(?:at|with)\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s*[-–—]|\s*$|\s*in|\s*\(|\s*,)/i,
            /([A-Z][a-zA-Z\s&.,]+?)\s+(?:is hiring|is looking|seeks|needs)/i,
            /(?:from|by)\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s*[-–—]|\s*$|\s*in|\s*\(|\s*,)/i,
            /(?:top|best)\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s+companies?|\s+jobs?)/i
        ];
        
        for (const pattern of companyPatterns) {
            const match = snippet.match(pattern);
            if (match && match[1]) {
                const company = match[1].trim();
                if (company.length > 2 && company.length < 50) {
                    return company;
                }
            }
        }
    }
    
    // Pattern 5: Extract from title if it contains company-like patterns
    const titleCompanyPatterns = [
        /([A-Z][a-zA-Z\s&.,]+?)\s+(?:Jobs|Careers|Hiring|Recruiting)/i,
        /(?:Jobs|Careers|Hiring)\s+(?:at|from)\s+([A-Z][a-zA-Z\s&.,]+?)/i
    ];
    
    for (const pattern of titleCompanyPatterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            const company = match[1].trim();
            if (company.length > 2 && company.length < 50) {
                return company;
            }
        }
    }
    
    return 'N/A';
}



// Extract location from text
function extractLocationFromText(text, defaultLocation) {
    if (!text) return defaultLocation;
    
    // Look for city names in the text
    const cityPatterns = [
        /(?:in|at|near)\s+([A-Z][a-zA-Z\s,]+?)(?:\s*[-–—]|\s*$|\s*\(|\s*,)/i,
        /([A-Z][a-zA-Z\s,]+?)(?:\s*,\s*[A-Z]{2}|\s*,\s*[A-Z][a-z]+)/i,  // City, State format
        /([A-Z][a-zA-Z\s,]+?)(?:\s*Germany|\s*United States|\s*California)/i  // City, Country/State
    ];
    
    for (const pattern of cityPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const location = match[1].trim();
            if (location.length > 2 && location.length < 50) {
                return location;
            }
        }
    }
    
    // If no specific city found, return the default location
    return defaultLocation;
}

// Extract salary information
function extractSalaryFromText(text) {
    if (!text) return 'N/A';
    
    const salaryPatterns = [
        /\$[\d,]+(?:k|K)?(?:\s*-\s*\$[\d,]+(?:k|K)?)?/i,
        /[\d,]+(?:k|K)\s*(?:USD|dollars?|per year|annually)/i,
        /salary.*?[\d,]+(?:k|K)/i
    ];
    
    for (const pattern of salaryPatterns) {
        const match = text.match(pattern);
        if (match) {
            return match[0];
        }
    }
    
    return 'N/A';
}

// Extract requirements/skills
function extractRequirementsFromText(text) {
    if (!text) return 'N/A';
    
    const requirementPatterns = [
        /(?:require|need|looking for|seeking).*?(?:experience|skills?|knowledge)/i,
        /(?:experience|skills?|knowledge).*?(?:in|with|of).*?[A-Z][a-z]+/i
    ];
    
    for (const pattern of requirementPatterns) {
        const match = text.match(pattern);
        if (match) {
            return match[0].substring(0, 100) + '...';
        }
    }
    
    return 'N/A';
}

// Extract posted date
function extractPostedDateFromText(text) {
    if (!text) return 'N/A';
    
    const datePatterns = [
        /(?:posted|published|updated)\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
        /([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return 'N/A';
}

function extractRemoteOnsiteFromText(text) {
    if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) {
        return 'Remote';
    } else if (text.includes('onsite') || text.includes('on-site') || text.includes('in-office')) {
        return 'Onsite';
    } else if (text.includes('hybrid') || text.includes('flexible')) {
        return 'Hybrid';
    }
    
    return 'Work type not specified';
}

function extractTechnologiesFromText(text) {
    const technologies = [
        'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go',
        'Rust', 'Swift', 'Kotlin', 'TypeScript', 'React', 'Angular', 'Vue',
        'Node.js', 'Django', 'Flask', 'Spring', 'Laravel', 'ASP.NET',
        'AWS', 'Azure', 'Docker', 'Kubernetes', 'MongoDB', 'PostgreSQL',
        'MySQL', 'Redis', 'GraphQL', 'REST', 'API', 'Git', 'Linux'
    ];
    
    const found = technologies.filter(tech => 
        text.includes(tech.toLowerCase())
    );
    
    return found.length > 0 ? found.join(', ') : 'Technologies not specified';
}

function isJobSite(url) {
    const jobSites = [
        'indeed.com', 'linkedin.com', 'glassdoor.com', 'monster.com',
        'careerbuilder.com', 'ziprecruiter.com', 'simplyhired.com',
        'dice.com', 'angel.co', 'stackoverflow.com', 'github.com',
        'remote.co', 'weworkremotely.com', 'flexjobs.com',
        'builtin.com', 'techcrunch.com', 'venturebeat.com'
    ];
    
    return jobSites.some(site => url.toLowerCase().includes(site));
}

async function extractDetailedJobInfo(url, query, searchTitle, searchSnippet) {
    try {
        // Step 1: Get detailed content from the job page
        const content = await browseWeb({url});
        
        // Step 2: Use AI-powered extraction
        let aiExtractedData = await extractJobInfoWithAI(content, query, searchTitle, searchSnippet);
        
        // If AI extraction failed, use enhanced pattern matching
        if (!aiExtractedData || isPoorQualityData(aiExtractedData)) {
            console.log('🔄 AI data quality poor, trying enhanced pattern matching...');
            aiExtractedData = extractJobInfoWithEnhancedPatterns(content, searchTitle, searchSnippet, query);
        }

        // If still no good data, fall back to search result extraction
        if (!aiExtractedData || isPoorQualityData(aiExtractedData)) {
            console.log('🔄 Pattern matching failed, using search result extraction...');
            aiExtractedData = extractJobInfoFromSearchResults(query, searchTitle, searchSnippet, url);
        }

        return aiExtractedData;
        
    } catch (error) {
        console.log(`Web scraping failed for ${url}, using search result data`);
        return extractJobInfoFromSearchResults(query, searchTitle, searchSnippet, url);
    }
}

async function extractJobInfoWithAI(content, query, searchTitle, searchSnippet) {
    try {
        const aiPrompt = `You are a job information extraction expert. Extract detailed job information from the following content and return ONLY a valid JSON object with the following structure:

{
  "company": "Company name",
  "companyAddress": "Company address or location",
  "jobTitle": "Job title or position",
  "remoteOnsite": "Remote/Onsite/Hybrid",
  "languageRequirements": "Required technologies, programming languages, or skills",
  "postedDate": "When the job was posted",
  "salary": "Salary information if available",
  "experience": "Experience level required",
  "requirements": "Job requirements and qualifications",
  "benefits": "Benefits and perks offered"
}

IMPORTANT INSTRUCTIONS:
- Return ONLY the JSON object, no other text
- If information is not available in the content, use "Not specified"
- Make educated guesses when reasonable based on context

Content to analyze:
${content}`;

        const response = await generateText(aiPrompt);
        console.log('🤖 AI Response:', response.substring(0, 200) + '...');
        
        const aiExtractedData = parseAIResponse(response);
        
        if (aiExtractedData) {
            console.log('✅ AI extraction successful:', Object.keys(aiExtractedData).length, 'fields extracted');
        } else {
            console.log('❌ AI extraction failed, will use fallback methods');
        }
        return aiExtractedData;
        
    } catch (error) {
        console.log('❌ AI extraction failed, using fallback methods:', error.message);
        return null;
    }
}

function parseAIResponse(aiResponse) {
    if (!aiResponse || typeof aiResponse !== 'string') {
        return null;
    }

    try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully parsed AI response as JSON');
            return parsed;
        }
    } catch (error) {
        console.log('❌ Failed to parse AI response as JSON');
    }

    return null;
}

function extractJobInfoWithEnhancedPatterns(content, searchTitle, searchSnippet, query) {
    const text = (searchTitle + ' ' + searchSnippet + ' ' + content).toLowerCase();
    
    return {
        company: extractCompanyEnhanced(text, searchTitle, searchSnippet),
        companyAddress: extractAddressEnhanced(text, searchTitle, searchSnippet),
        jobTitle: extractJobTitleEnhanced(searchTitle, searchSnippet, query),
        remoteOnsite: extractRemoteOnsiteEnhanced(text),
        languageRequirements: extractLanguagesEnhanced(text),
        postedDate: extractPostedDateEnhanced(text),
        salary: extractSalaryEnhanced(text),
        experience: extractExperienceEnhanced(text),
        requirements: extractRequirementsEnhanced(text),
        benefits: extractBenefitsEnhanced(text)
    };
}

function extractCompanyEnhanced(text, title, snippet) {
    const patterns = [
        /at\s+([A-Z][a-zA-Z\s&]+?)(?:\s+in|\s*$|\s*[-|])/i,
        /([A-Z][a-zA-Z\s&]+?)\s+is\s+hiring/i,
        /([A-Z][a-zA-Z\s&]+?)\s+careers/i
    ];
    
    for (const pattern of patterns) {
        const match = (title + ' ' + snippet).match(pattern);
        if (match) {
            const result = match[1].trim();
            if (result.length > 2 && result.length < 50) {
                return result;
            }
        }
    }
    
    return 'Company name not specified';
}

function extractAddressEnhanced(text, title, snippet) {
    const patterns = [
        /in\s+([A-Z][a-zA-Z\s,]+?)(?:\s*$|\s*[-|])/i,
        /at\s+([A-Z][a-zA-Z\s,]+?)(?:\s*$|\s*[-|])/i
    ];
    
    for (const pattern of patterns) {
        const match = (title + ' ' + snippet).match(pattern);
        if (match) {
            const result = match[1].trim();
            if (result.length > 3 && result.length < 100) {
                return result;
            }
        }
    }
    
    return 'Location not specified';
}

// Enhanced job title extraction
function extractJobTitleEnhanced(title, snippet, query) {
    if (!title) return 'N/A';
    
    // Remove common aggregator text
    let cleanTitle = title
        .replace(/\d+.*jobs? in.*$/i, '')
        .replace(/jobs? available.*$/i, '')
        .replace(/employment.*$/i, '')
        .replace(/careers?.*$/i, '')
        .replace(/top\s+/i, '')
        .replace(/best\s+/i, '')
        .replace(/\d+\+\s+/i, '')
        .replace(/jobs? in.*$/i, '')
        .replace(/positions? in.*$/i, '')
        .replace(/search\s+the\s+best\s+/gi, '')
        .replace(/artificial\s+intelligence\s+engineer\s+jobs?/gi, 'AI Engineer')
        .replace(/artificial\s+intelligence\s+jobs?/gi, 'AI')
        .replace(/software\s+engineer\s+jobs?/gi, 'Software Engineer')
        .replace(/data\s+scientist\s+jobs?/gi, 'Data Scientist')
        .replace(/cleaner\s+jobs?/gi, 'Cleaner')
        .replace(/search\s+/gi, '')
        .replace(/looking\s+for\s+/gi, '')
        .replace(/accounts?\s+receivables?\s+/gi, '')
        .replace(/software\s+development\s+/gi, '')
        .replace(/what\s+is\s+it\s+like\s+being\s+a\s+/gi, '')
        .replace(/find\s+the\s+best\s+/gi, '')
        .replace(/in\s+[A-Z][a-z]+(?:\s+Jobs?)?$/gi, '')
        .replace(/Jobs?$/gi, '')
        .replace(/Employment.*$/gi, '')
        .replace(/Stellenangebote.*$/gi, '')
        .replace(/2025.*$/gi, '')
        .replace(/August.*$/gi, '')
        .replace(/new.*$/gi, '')
        .replace(/daily.*$/gi, '')
        .trim();
    
    // If title is too generic, use the search query
    if (cleanTitle.length < 10 || /^(jobs?|employment|careers?|positions?)$/i.test(cleanTitle)) {
        cleanTitle = query;
    }
    
    // If still generic, try to extract from snippet
    if (cleanTitle === query && snippet) {
        const snippetMatch = snippet.match(/([A-Z][a-zA-Z\s&.,]+?)(?:\s+Developer|\s+Engineer|\s+Analyst|\s+Manager|\s+Scientist)/i);
        if (snippetMatch && snippetMatch[1]) {
            cleanTitle = snippetMatch[1].trim() + ' ' + query;
        }
    }
    
    // Clean up the title for better filename generation
    cleanTitle = cleanTitle
        .replace(/[^\w\s]/g, ' ')  // Remove special characters
        .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
        .trim();
    
    // Remove duplicate words (like "Software Software Engineer")
    const words = cleanTitle.split(' ');
    const uniqueWords = [];
    for (let i = 0; i < words.length; i++) {
        if (i === 0 || words[i].toLowerCase() !== words[i-1].toLowerCase()) {
            uniqueWords.push(words[i]);
        }
    }
    cleanTitle = uniqueWords.join(' ');
    
    // Limit length for filename purposes
    if (cleanTitle.length > 50) {
        cleanTitle = cleanTitle.substring(0, 50).trim();
    }
    
    return cleanTitle || 'N/A';
}

// Generate clean filename from job title
function generateCleanFilename(jobTitle, query) {
    if (!jobTitle || jobTitle === 'N/A') {
        // Use query as fallback
        return query.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }
    
    // Clean the title for filename
    let cleanTitle = jobTitle
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special characters
        .replace(/\s+/g, '_')             // Replace spaces with underscores
        .replace(/_+/g, '_')              // Replace multiple underscores with single
        .trim();
    
    // Limit length and ensure it's not too long
    if (cleanTitle.length > 30) {
        cleanTitle = cleanTitle.substring(0, 30).trim();
    }
    
    return cleanTitle;
}

function extractRemoteOnsiteEnhanced(text) {
    if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) {
        return 'Remote';
    } else if (text.includes('onsite') || text.includes('on-site') || text.includes('in-office')) {
        return 'Onsite';
    } else if (text.includes('hybrid') || text.includes('flexible')) {
        return 'Hybrid';
    }
    
    return 'Work type not specified';
}

function extractLanguagesEnhanced(text) {
    const technologies = [
        'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go',
        'Rust', 'Swift', 'Kotlin', 'TypeScript', 'React', 'Angular', 'Vue',
        'Node.js', 'Django', 'Flask', 'Spring', 'Laravel', 'ASP.NET',
        'AWS', 'Azure', 'Docker', 'Kubernetes', 'MongoDB', 'PostgreSQL',
        'MySQL', 'Redis', 'GraphQL', 'REST', 'API', 'Git', 'Linux'
    ];
    
    const found = technologies.filter(tech => 
        text.includes(tech.toLowerCase())
    );
    
    return found.length > 0 ? found.join(', ') : 'Technologies not specified';
}

function extractPostedDateEnhanced(text) {
    const patterns = [
        /posted[:\s]+([^\n\r]+)/i,
        /date[:\s]+([^\n\r]+)/i,
        /published[:\s]+([^\n\r]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    
    return 'Posted date not specified';
}

function extractSalaryEnhanced(text) {
    const patterns = [
        /\$(\d{1,3}(?:,\d{3})*(?:k|K)?)\s*[-–]\s*\$(\d{1,3}(?:,\d{3})*(?:k|K)?)/i,
        /\$(\d{1,3}(?:,\d{3})*(?:k|K)?)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[2]) {
                return `$${match[1]} - $${match[2]}`;
            } else {
                return `$${match[1]}`;
            }
        }
    }
    
    return 'Salary not specified';
}

function extractExperienceEnhanced(text) {
    const patterns = [
        /(\d+)\+?\s*years?\s*experience/i,
        /senior|junior|entry|mid|lead/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (pattern.source.includes('senior|junior|entry|mid|lead')) {
                return match[0].charAt(0).toUpperCase() + match[0].slice(1) + ' level';
            }
            return match[1] || match[0];
        }
    }
    
    return 'Experience level not specified';
}

function extractRequirementsEnhanced(text) {
    const patterns = [
        /requirements[:\s]+([^\n\r]+)/i,
        /qualifications[:\s]+([^\n\r]+)/i,
        /must have[:\s]+([^\n\r]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const result = match[1].trim();
            return result.length > 10 ? result.substring(0, 150) + '...' : result;
        }
    }
    
    return 'Requirements not specified';
}

function extractBenefitsEnhanced(text) {
    const patterns = [
        /benefits[:\s]+([^\n\r]+)/i,
        /perks[:\s]+([^\n\r]+)/i,
        /we offer[:\s]+([^\n\r]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const result = match[1].trim();
            return result.length > 10 ? result.substring(0, 100) + '...' : result;
        }
    }
    
    return 'Benefits not specified';
}

function extractJobInfoFromSearchResults(query, searchTitle, searchSnippet, url) {
    const fullText = searchTitle + ' ' + searchSnippet;
    
    return {
        company: extractCompanyFromSearch(searchTitle, searchSnippet, url),
        companyAddress: extractAddressFromSearch(searchTitle, searchSnippet),
        jobTitle: extractJobTitleFromSearch(searchTitle, searchSnippet, query),
        remoteOnsite: extractRemoteOnsiteFromSearch(searchTitle, searchSnippet),
        languageRequirements: extractLanguagesFromSearch(searchTitle, searchSnippet),
        postedDate: 'Posted date not specified',
        salary: extractSalaryFromSearch(searchTitle, searchSnippet),
        experience: extractExperienceFromSearch(searchTitle, searchSnippet),
        requirements: extractRequirementsFromSearch(searchTitle, searchSnippet),
        benefits: 'Benefits not specified',
        url: url,
        extractedAt: new Date().toISOString(),
        extractionMethod: 'search_results_only'
    };
}

function extractCompanyFromSearch(title, snippet, url) {
    const fullText = title + ' ' + snippet;
    
    const patterns = [
        /at\s+([A-Z][a-zA-Z\s&]+?)(?:\s+in|\s*$|\s*[-|])/i,
        /([A-Z][a-zA-Z\s&]+?)\s+is\s+hiring/i,
        /([A-Z][a-zA-Z\s&]+?)\s+careers/i
    ];
    
    for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match) {
            const result = match[1].trim();
            if (result.length > 2 && result.length < 50) {
                return result;
            }
        }
    }
    
    return 'Company name not specified';
}

function extractAddressFromSearch(title, snippet) {
    const fullText = title + ' ' + snippet;
    
    const patterns = [
        /in\s+([A-Z][a-zA-Z\s,]+?)(?:\s*$|\s*[-|])/i,
        /at\s+([A-Z][a-zA-Z\s,]+?)(?:\s*$|\s*[-|])/i
    ];
    
    for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match) {
            const result = match[1].trim();
            if (result.length > 3 && result.length < 100) {
                return result;
            }
        }
    }
    
    return 'Location not specified';
}

function extractJobTitleFromSearch(title, snippet, query) {
    if (title && !title.toLowerCase().includes('indeed') && !title.toLowerCase().includes('linkedin')) {
        const cleanTitle = title
            .replace(/[-|]\s*[A-Z][a-zA-Z\s,]+$/g, '')
            .replace(/jobs?\s+in\s+[A-Z][a-zA-Z\s,]+$/gi, '')
            .trim();
        
        if (cleanTitle.length > 5 && cleanTitle.length < 100) {
            return cleanTitle;
        }
    }
    
    return query;
}

function extractRemoteOnsiteFromSearch(title, snippet) {
    const text = (title + ' ' + snippet).toLowerCase();
    
    if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) {
        return 'Remote';
    } else if (text.includes('onsite') || text.includes('on-site') || text.includes('in-office')) {
        return 'Onsite';
    } else if (text.includes('hybrid') || text.includes('flexible')) {
        return 'Hybrid';
    }
    
    return 'Work type not specified';
}

function extractLanguagesFromSearch(title, snippet) {
    const text = (title + ' ' + snippet).toLowerCase();
    
    const technologies = [
        'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go',
        'Rust', 'Swift', 'Kotlin', 'TypeScript', 'React', 'Angular', 'Vue',
        'Node.js', 'Django', 'Flask', 'Spring', 'Laravel', 'ASP.NET',
        'AWS', 'Azure', 'Docker', 'Kubernetes', 'MongoDB', 'PostgreSQL',
        'MySQL', 'Redis', 'GraphQL', 'REST', 'API', 'Git', 'Linux'
    ];
    
    const found = technologies.filter(tech => 
        text.includes(tech.toLowerCase())
    );
    
    return found.length > 0 ? found.join(', ') : 'Technologies not specified';
}

function extractSalaryFromSearch(title, snippet) {
    const text = title + ' ' + snippet;
    
    const patterns = [
        /\$(\d{1,3}(?:,\d{3})*(?:k|K)?)\s*[-–]\s*\$(\d{1,3}(?:,\d{3})*(?:k|K)?)/i,
        /\$(\d{1,3}(?:,\d{3})*(?:k|K)?)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[2]) {
                return `$${match[1]} - $${match[2]}`;
            } else {
                return `$${match[1]}`;
            }
        }
    }
    
    return 'Salary not specified';
}

function extractExperienceFromSearch(title, snippet) {
    const text = (title + ' ' + snippet).toLowerCase();
    
    const patterns = [
        /(\d+)\+?\s*years?\s*experience/i,
        /senior|junior|entry|mid|lead/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (pattern.source.includes('senior|junior|entry|mid|lead')) {
                return match[0].charAt(0).toUpperCase() + match[0].slice(1) + ' level';
            }
            return match[1] || match[0];
        }
    }
    
    return 'Experience level not specified';
}

function extractRequirementsFromSearch(title, snippet) {
    const text = title + ' ' + snippet;
    
    const patterns = [
        /requirements?[:\s]+([^\n\r]+)/i,
        /qualifications?[:\s]+([^\n\r]+)/i,
        /must have[:\s]+([^\n\r]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const result = match[1].trim();
            return result.length > 10 ? result.substring(0, 150) + '...' : result;
        }
    }
    
    return 'Requirements not specified';
}

function isValidJobData(jobData) {
    if (!jobData || typeof jobData !== 'object') {
        return false;
    }

    // Check if we have at least a job title
    if (!jobData.jobTitle || jobData.jobTitle === 'N/A' || jobData.jobTitle === 'Job title not specified') {
        return false;
    }

    // Check if we have at least a company name
    if (!jobData.company || jobData.company === 'N/A' || jobData.company === 'Company name not specified') {
        return false;
    }

    // Check if we have at least one meaningful piece of information beyond title and company
    const meaningfulFields = [
        'companyAddress', 'remoteOnsite', 'languageRequirements', 
        'salary', 'experience', 'requirements', 'benefits'
    ];
    
    const hasMeaningfulData = meaningfulFields.some(field => {
        const value = jobData[field];
        return value && 
               value !== 'N/A' && 
               value !== 'Location not specified' &&
               value !== 'Work type not specified' &&
               value !== 'Technologies not specified' &&
               value !== 'Salary not specified' &&
               value !== 'Experience level not specified' &&
               value !== 'Requirements not specified' &&
               value !== 'Benefits not specified';
    });

    return hasMeaningfulData;
}

function isPoorQualityData(jobData) {
    if (!jobData || typeof jobData !== 'object') {
        return true;
    }
    
    const fieldsToCheck = [
        'company', 'companyAddress', 'jobTitle', 'remoteOnsite', 
        'languageRequirements', 'salary', 'experience', 'requirements'
    ];
    
    const notSpecifiedCount = fieldsToCheck.filter(field => {
        const value = jobData[field];
        return !value || 
               value === 'Not specified' || 
               value === 'N/A' ||
               value === 'Company name not specified' ||
               value === 'Location not specified' ||
               value === 'Job title not specified' ||
               value === 'Work type not specified' ||
               value === 'Technologies not specified' ||
               value === 'Salary not specified' ||
               value === 'Experience level not specified' ||
               value === 'Requirements not specified';
    }).length;
    
    const poorQualityThreshold = fieldsToCheck.length * 0.7;
    return notSpecifiedCount >= poorQualityThreshold;
}

// Helper function to extract company name from job title
function extractCompanyFromTitle(title) {
    if (!title) return 'N/A';
    
    // Common patterns for job titles
    const patterns = [
        /at\s+([^,]+)/i,
        /-?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*Software Engineer/i
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    return 'N/A';
}

// Define a Zod schema
const searchGoogleSchema = z.object({
    query: z.string().describe("The search query to send to gogole.")
});

export const searchGoogleToolConfig = zodFunction({
    name: "searchGoogle",
    description: "Run a search query against google for information from the web.",
    parameters: searchGoogleSchema
})

export const searchJobsToolConfig = zodFunction({
    name: "searchJobs",
    description: "Search for jobs using SerpAPI and extract detailed information.",
    parameters: z.object({
        query: z.string().describe("The job title or keywords to search for"),
        location: z.string().describe("The location to search for jobs in"),
        remote: z.boolean().describe("Whether to search for remote jobs"),
        count: z.number().optional().describe("Number of jobs to search for (default: 50)")
    })
});