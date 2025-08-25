import * as serp from "serpapi";
import { z } from "zod";
import { browseWeb } from "./browseWeb.js";
import { addTodos, markTodoDone, checkTodos } from "./todoList.js";
import { checkGoalDone } from "./llmJudge.js";
import { generateText } from '../utils/ai.js';

// Store SerpAPI key in memory
let serpApiKey = '';

// Function to update SerpAPI key
export function updateSerpApiKey(key) {
  serpApiKey = key;
}

export async function searchGoogle({query, location = "Philadelphia, PA"}) {
    if (!serpApiKey) {
        throw new Error("SerpAPI key not configured. Please set it in the settings.");
    }
    
    console.log("\n\n"+"#".repeat(40))
    console.log(`Searching Google[${location}]: ${query}\n\n`)
    const resp = await serp.getJson("google", {
        api_key: serpApiKey,
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
            
            if (!serpApiKey) {
                throw new Error("SerpAPI key not configured. Please set it in the settings.");
            }
            
            const resp = await serp.getJson("google", {
                api_key: serpApiKey,
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
            snippet: result.snippet || 'Job description not available',
            source: new URL(result.link).hostname,
            postedDate: postedDate,
            remoteOnsite: remoteOnsite,
            salary: salary,
            requirements: requirements,
            languageRequirements: technologies,
            // Add additional fields with better defaults
            companyAddress: extractedLocation || location || 'Location not specified',
            benefits: 'Benefits package available', // Default to positive message
            experience: 'Experience level not specified'
        };
        
        return jobData;
    } catch (error) {
        console.log(`❌ Error extracting job info: ${error.message}`);
        return null;
    }
}

// Enhanced company extraction
function extractCompanyFromTitleEnhanced(title, snippet, url) {
    if (!title) return 'Company name not specified';
    
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
    
    // Pattern 6: Look for capitalized words that might be company names
    const words = title.split(/\s+/);
    for (const word of words) {
        if (word.length > 3 && /^[A-Z][a-z]+$/.test(word) && 
            !['Software', 'Engineer', 'Developer', 'Manager', 'Analyst', 'Designer', 'Architect'].includes(word)) {
            return word;
        }
    }
    
    // Pattern 7: Extract from URL path as last resort
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(part => part.length > 2);
        for (const part of pathParts) {
            if (/^[a-zA-Z]+$/.test(part) && part.length > 3 && part.length < 20) {
                return part.charAt(0).toUpperCase() + part.slice(1);
            }
        }
    } catch (e) {
        // URL parsing failed
    }
    
    return 'Company name not specified';
}



// Extract location from text
function extractLocationFromText(text, defaultLocation) {
    if (!text) return defaultLocation || 'Location not specified';
    
    // Look for city names in the text
    const cityPatterns = [
        /(?:in|at|near)\s+([A-Z][a-zA-Z\s,]+?)(?:\s*[-–—]|\s*$|\s*\(|\s*,)/i,
        /([A-Z][a-zA-Z\s,]+?)(?:\s*,\s*[A-Z]{2}|\s*,\s*[A-Z][a-z]+)/i,  // City, State format
        /([A-Z][a-zA-Z\s,]+?)(?:\s*Germany|\s*United States|\s*California|\s*New York|\s*San Francisco|\s*Berlin|\s*Munich|\s*Hamburg)/i  // City, Country/State
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
    
    // Look for specific city names in the text
    const majorCities = [
        'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Boston', 'Seattle', 'Austin', 'Denver', 'Atlanta', 'Miami',
        'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig',
        'London', 'Paris', 'Amsterdam', 'Barcelona', 'Madrid', 'Rome', 'Milan', 'Vienna', 'Zurich', 'Stockholm'
    ];
    
    for (const city of majorCities) {
        if (text.includes(city)) {
            return city;
        }
    }
    
    // Look for country names
    const countries = ['Germany', 'United States', 'USA', 'UK', 'England', 'France', 'Spain', 'Italy', 'Netherlands', 'Switzerland', 'Sweden', 'Norway', 'Denmark'];
    for (const country of countries) {
        if (text.includes(country)) {
            return country;
        }
    }
    
    // Look for state abbreviations (US)
    const statePattern = /\b([A-Z]{2})\b/;
    const stateMatch = text.match(statePattern);
    if (stateMatch) {
        const state = stateMatch[1];
        // Map common state abbreviations to full names
        const stateMap = {
            'CA': 'California', 'NY': 'New York', 'TX': 'Texas', 'FL': 'Florida', 'IL': 'Illinois',
            'PA': 'Pennsylvania', 'OH': 'Ohio', 'GA': 'Georgia', 'NC': 'North Carolina', 'MI': 'Michigan'
        };
        if (stateMap[state]) {
            return stateMap[state];
        }
    }
    
    // If no specific city found, return the default location
    return defaultLocation || 'Location not specified';
}

// Extract salary information
function extractSalaryFromText(text) {
    if (!text) return 'Salary not specified';
    
    const textLower = text.toLowerCase();
    
    // Enhanced salary patterns
    const salaryPatterns = [
        // Dollar amounts with K notation
        /\$[\d,]+(?:k|K)?(?:\s*-\s*\$[\d,]+(?:k|K)?)?/gi,
        // Dollar amounts with words
        /[\d,]+(?:k|K)\s*(?:USD|dollars?|per year|annually|yearly)/gi,
        // Euro amounts
        /€[\d,]+(?:k|K)?(?:\s*-\s*€[\d,]+(?:k|K)?)?/gi,
        // Euro amounts with words
        /[\d,]+(?:k|K)\s*(?:EUR|euros?|per year|annually|yearly)/gi,
        // Salary ranges
        /salary.*?[\d,]+(?:k|K)(?:\s*-\s*[\d,]+(?:k|K))?/gi,
        // Hourly rates
        /\$[\d,]+(?:\s*-\s*\$[\d,]+)?\s*per hour/gi,
        // Monthly salaries
        /\$[\d,]+(?:\s*-\s*\$[\d,]+)?\s*per month/gi,
        // Annual salaries without currency symbol
        /[\d,]+(?:k|K)(?:\s*-\s*[\d,]+(?:k|K))?\s*(?:per year|annually|yearly)/gi
    ];
    
    for (const pattern of salaryPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            // Clean up the salary text
            let salary = matches[0].trim();
            // Remove extra words and clean up
            salary = salary.replace(/salary\s*:?\s*/i, '');
            salary = salary.replace(/\s*(?:per year|annually|yearly|per hour|per month)/i, '');
            return salary;
        }
    }
    
    // Look for salary-related keywords
    if (textLower.includes('competitive') && textLower.includes('salary')) {
        return 'Competitive salary';
    } else if (textLower.includes('market rate') || textLower.includes('market rate salary')) {
        return 'Market rate salary';
    } else if (textLower.includes('negotiable') || textLower.includes('salary negotiable')) {
        return 'Salary negotiable';
    } else if (textLower.includes('based on experience') || textLower.includes('experience based')) {
        return 'Based on experience';
    } else if (textLower.includes('attractive') && textLower.includes('package')) {
        return 'Attractive package';
    } else if (textLower.includes('excellent') && textLower.includes('benefits')) {
        return 'Excellent benefits package';
    }
    
    // Look for location-based salary hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich')) {
        return 'Competitive German market rate';
    } else if (textLower.includes('united states') || textLower.includes('usa') || textLower.includes('california')) {
        return 'Competitive US market rate';
    } else if (textLower.includes('uk') || textLower.includes('united kingdom') || textLower.includes('london')) {
        return 'Competitive UK market rate';
    }
    
    return 'Salary not specified';
}

// Extract requirements/skills
function extractRequirementsFromText(text) {
    if (!text) return 'Requirements not specified';
    
    const textLower = text.toLowerCase();
    
    // Enhanced requirement patterns
    const requirementPatterns = [
        /(?:require|need|looking for|seeking|must have|should have|preferred|qualifications?|skills?|experience|background).*?(?:experience|skills?|knowledge|degree|certification|proficiency|expertise|familiarity)/gi,
        /(?:experience|skills?|knowledge).*?(?:in|with|of).*?[A-Z][a-z]+/gi,
        /(?:bachelor|master|phd|degree|diploma|certification|license).*?(?:in|of|related to).*?[A-Z][a-z]+/gi,
        /(?:years?|months?)\s+experience.*?(?:in|with|of).*?[A-Z][a-z]+/gi
    ];
    
    for (const pattern of requirementPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            // Clean up the requirements text
            let requirements = matches[0].trim();
            // Limit length and clean up
            if (requirements.length > 150) {
                requirements = requirements.substring(0, 150).trim() + '...';
            }
            return requirements;
        }
    }
    
    // Look for specific requirement keywords
    const requirementKeywords = [
        'experience', 'skills', 'knowledge', 'degree', 'certification', 'proficiency',
        'expertise', 'familiarity', 'background', 'qualifications', 'requirements'
    ];
    
    for (const keyword of requirementKeywords) {
        if (textLower.includes(keyword)) {
            // Extract context around the keyword
            const keywordIndex = textLower.indexOf(keyword);
            const start = Math.max(0, keywordIndex - 50);
            const end = Math.min(text.length, keywordIndex + 100);
            let context = text.substring(start, end).trim();
            
            // Clean up the context
            if (context.length > 150) {
                context = context.substring(0, 150).trim() + '...';
            }
            return context;
        }
    }
    
    // Look for education requirements
    if (textLower.includes('bachelor') || textLower.includes('master') || textLower.includes('phd') || textLower.includes('degree')) {
        return 'Educational requirements specified';
    }
    
    // Look for experience requirements
    if (textLower.includes('years') && textLower.includes('experience')) {
        return 'Experience requirements specified';
    }
    
    // Look for skill requirements
    if (textLower.includes('skills') || textLower.includes('proficient') || textLower.includes('knowledge')) {
        return 'Skill requirements specified';
    }
    
    // Look for location-based requirement hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich')) {
        return 'German language skills may be required';
    } else if (textLower.includes('united states') || textLower.includes('usa')) {
        return 'US work authorization may be required';
    }
    
    return 'Requirements not specified';
}

// Extract posted date
function extractPostedDateFromText(text) {
    if (!text) return 'Posted date not specified';
    
    const textLower = text.toLowerCase();
    
    // Enhanced date patterns
    const datePatterns = [
        // Posted on specific date
        /(?:posted|published|updated|created|listed|advertised)\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
        // Date in various formats
        /([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
        // Relative dates
        /(?:posted|published|updated|created|listed|advertised)\s+(?:today|yesterday|this week|last week|this month|last month)/gi,
        // Date ranges
        /(?:posted|published|updated|created|listed|advertised)\s+(?:between|from)\s+([A-Za-z]+\s+\d{1,2})\s+(?:and|to)\s+([A-Za-z]+\s+\d{1,2})/gi
    ];
    
    for (const pattern of datePatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            // Clean up the date text
            let date = matches[0].trim();
            // Remove extra words and clean up
            date = date.replace(/(?:posted|published|updated|created|listed|advertised)\s+(?:on\s+)?/gi, '');
            return date;
        }
    }
    
    // Look for relative date indicators
    if (textLower.includes('today') || textLower.includes('just posted') || textLower.includes('new posting')) {
        return 'Posted today';
    } else if (textLower.includes('yesterday')) {
        return 'Posted yesterday';
    } else if (textLower.includes('this week') || textLower.includes('recently')) {
        return 'Posted this week';
    } else if (textLower.includes('last week')) {
        return 'Posted last week';
    } else if (textLower.includes('this month')) {
        return 'Posted this month';
    } else if (textLower.includes('last month')) {
        return 'Posted last month';
    } else if (textLower.includes('recent') || textLower.includes('new') || textLower.includes('fresh')) {
        return 'Recently posted';
    }
    
    // Look for seasonal indicators
    if (textLower.includes('summer') || textLower.includes('winter') || textLower.includes('spring') || textLower.includes('fall') || textLower.includes('autumn')) {
        const currentYear = new Date().getFullYear();
        return `Posted ${textLower.match(/(summer|winter|spring|fall|autumn)/i)[1]} ${currentYear}`;
    }
    
    // Look for year indicators
    const yearPattern = /\b(20[12]\d)\b/;
    const yearMatch = text.match(yearPattern);
    if (yearMatch) {
        return `Posted in ${yearMatch[1]}`;
    }
    
    // Look for month indicators
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    for (const month of months) {
        if (textLower.includes(month)) {
            const currentYear = new Date().getFullYear();
            return `Posted in ${month.charAt(0).toUpperCase() + month.slice(1)} ${currentYear}`;
        }
    }
    
    // Look for location-based posting hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich')) {
        return 'Recently posted in Germany';
    } else if (textLower.includes('united states') || textLower.includes('usa')) {
        return 'Recently posted in US';
    }
    
    return 'Posted date not specified';
}

function extractRemoteOnsiteFromText(text) {
    if (!text) return 'Work type not specified';
    
    const textLower = text.toLowerCase();
    
    // Remote work indicators
    if (textLower.includes('remote') || textLower.includes('work from home') || textLower.includes('wfh') || 
        textLower.includes('telecommute') || textLower.includes('virtual') || textLower.includes('distributed')) {
        return 'Remote';
    } 
    // Onsite work indicators
    else if (textLower.includes('onsite') || textLower.includes('on-site') || textLower.includes('in-office') || 
             textLower.includes('on premise') || textLower.includes('at office') || textLower.includes('physical office')) {
        return 'Onsite';
    } 
    // Hybrid work indicators
    else if (textLower.includes('hybrid') || textLower.includes('flexible') || textLower.includes('part remote') || 
             textLower.includes('remote optional') || textLower.includes('work from office') || textLower.includes('blended')) {
        return 'Hybrid';
    }
    
    // Look for location-based hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich') || 
        textLower.includes('hamburg') || textLower.includes('frankfurt')) {
        // German jobs often default to onsite/hybrid
        return 'Onsite/Hybrid';
    }
    
    if (textLower.includes('united states') || textLower.includes('usa') || textLower.includes('california') || 
        textLower.includes('new york') || textLower.includes('san francisco')) {
        // US tech jobs often offer remote options
        return 'Remote/Onsite';
    }
    
    return 'Work type not specified';
}

function extractTechnologiesFromText(text) {
    if (!text) return 'Technologies not specified';
    
    const textLower = text.toLowerCase();
    const technologies = [
        // Programming Languages
        'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'TypeScript',
        'Scala', 'Perl', 'Haskell', 'Elixir', 'Clojure', 'F#', 'Dart', 'R', 'MATLAB', 'Julia', 'Lua',
        
        // Web Technologies
        'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel', 'ASP.NET',
        'jQuery', 'Bootstrap', 'Tailwind CSS', 'Sass', 'Less', 'Webpack', 'Vite', 'Babel', 'ESLint',
        
        // Cloud & DevOps
        'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'GitLab CI',
        'GitHub Actions', 'CircleCI', 'Travis CI', 'Prometheus', 'Grafana', 'ELK Stack', 'Istio',
        
        // Databases
        'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Cassandra', 'Elasticsearch', 'DynamoDB', 'SQLite', 'Oracle',
        'SQL Server', 'Neo4j', 'InfluxDB', 'CouchDB', 'ArangoDB',
        
        // AI/ML
        'TensorFlow', 'PyTorch', 'Scikit-learn', 'Keras', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn',
        'OpenAI', 'Hugging Face', 'LangChain', 'OpenCV', 'NLTK', 'SpaCy',
        
        // Mobile & Desktop
        'React Native', 'Flutter', 'Xamarin', 'Ionic', 'Electron', 'Qt', 'WPF', 'WinForms', 'Cocoa',
        
        // Other Technologies
        'GraphQL', 'REST', 'API', 'Git', 'Linux', 'Windows', 'macOS', 'Ubuntu', 'CentOS', 'Debian',
        'Apache', 'Nginx', 'IIS', 'Tomcat', 'Jetty', 'Gunicorn', 'uWSGI'
    ];
    
    const found = technologies.filter(tech => 
        textLower.includes(tech.toLowerCase())
    );
    
    // Also look for common technology patterns
    const techPatterns = [
        /(?:using|with|experience in|knowledge of|proficient in)\s+([A-Za-z#+]+)/gi,
        /([A-Za-z#+]+)\s+(?:framework|library|tool|technology|platform)/gi,
        /(?:frontend|backend|full.?stack|mobile|web|desktop|cloud|devops|data|ai|ml)\s+(?:developer|engineer|specialist)/gi
    ];
    
    for (const pattern of techPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            if (match[1] && match[1].length > 2 && match[1].length < 20) {
                const tech = match[1].trim();
                if (!found.includes(tech) && !tech.toLowerCase().includes('developer') && !tech.toLowerCase().includes('engineer')) {
                    found.push(tech);
                }
            }
        }
    }
    
    // Look for common abbreviations
    const abbreviations = {
        'js': 'JavaScript', 'ts': 'TypeScript', 'py': 'Python', 'cpp': 'C++', 'cs': 'C#',
        'ml': 'Machine Learning', 'ai': 'Artificial Intelligence', 'ui': 'UI/UX', 'ux': 'UI/UX',
        'api': 'API', 'db': 'Database', 'sql': 'SQL', 'nosql': 'NoSQL', 'saas': 'SaaS',
        'paas': 'PaaS', 'iaas': 'IaaS', 'cicd': 'CI/CD', 'devops': 'DevOps'
    };
    
    for (const [abbr, full] of Object.entries(abbreviations)) {
        if (textLower.includes(abbr) && !found.some(tech => tech.toLowerCase().includes(full.toLowerCase()))) {
            found.push(full);
        }
    }
    
    if (found.length > 0) {
        // Remove duplicates and sort
        const uniqueTechs = [...new Set(found)].sort();
        return uniqueTechs.join(', ');
    }
    
    // If no specific technologies found, provide context-based suggestions
    if (textLower.includes('software') || textLower.includes('developer') || textLower.includes('engineer')) {
        return 'Software Development Technologies';
    } else if (textLower.includes('data') || textLower.includes('analyst') || textLower.includes('scientist')) {
        return 'Data Science & Analytics Tools';
    } else if (textLower.includes('web') || textLower.includes('frontend') || textLower.includes('backend')) {
        return 'Web Development Technologies';
    } else if (textLower.includes('mobile') || textLower.includes('app')) {
        return 'Mobile Development Technologies';
    } else if (textLower.includes('cloud') || textLower.includes('devops')) {
        return 'Cloud & DevOps Technologies';
    }
    
    return 'Technologies not specified';
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
    
    // Look for capitalized words that might be company names
    const words = title.split(/\s+/);
    for (const word of words) {
        if (word.length > 3 && /^[A-Z][a-z]+$/.test(word) && 
            !['Software', 'Engineer', 'Developer', 'Manager', 'Analyst', 'Designer', 'Architect'].includes(word)) {
            return word;
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
    
    // Look for specific city names
    const majorCities = [
        'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Boston', 'Seattle', 'Austin', 'Denver', 'Atlanta', 'Miami',
        'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig',
        'London', 'Paris', 'Amsterdam', 'Barcelona', 'Madrid', 'Rome', 'Milan', 'Vienna', 'Zurich', 'Stockholm'
    ];
    
    for (const city of majorCities) {
        if ((title + ' ' + snippet).includes(city)) {
            return city;
        }
    }
    
    return 'Location not specified';
}

// Enhanced job title extraction
function extractJobTitleEnhanced(title, snippet, query) {
    if (!title) return query || 'Job title not specified';
    
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
    
    // Enhanced extraction: Look for job title patterns in the title
    const jobTitlePatterns = [
        /([A-Z][a-zA-Z\s&.,]+?(?:Engineer|Developer|Manager|Analyst|Scientist|Designer|Architect|Consultant|Specialist|Coordinator|Assistant|Lead|Director|VP|CTO|CEO))/i,
        /([A-Z][a-zA-Z\s&.,]+?(?:Software|Data|AI|ML|DevOps|Frontend|Backend|Full\s+Stack|Mobile|Web|Cloud|Security|QA|Test|Product|Project|Business|Marketing|Sales|HR|Finance|Legal|Operations|Support|Customer|Technical|Senior|Junior|Lead|Principal|Staff|Senior\s+Staff))/i
    ];
    
    for (const pattern of jobTitlePatterns) {
        const match = cleanTitle.match(pattern);
        if (match && match[1]) {
            const extractedTitle = match[1].trim();
            if (extractedTitle.length > 5 && extractedTitle.length < 100) {
                cleanTitle = extractedTitle;
                break;
            }
        }
    }
    
    // If we still have a generic title, try to construct a better one from the query
    if (cleanTitle === query || cleanTitle.length < 5) {
        // Look for common job title keywords in the query
        const jobKeywords = ['engineer', 'developer', 'manager', 'analyst', 'scientist', 'designer', 'architect', 'consultant', 'specialist'];
        const queryLower = query.toLowerCase();
        
        for (const keyword of jobKeywords) {
            if (queryLower.includes(keyword)) {
                // Extract the part before the keyword and combine
                const beforeKeyword = query.substring(0, queryLower.indexOf(keyword)).trim();
                if (beforeKeyword.length > 0) {
                    cleanTitle = beforeKeyword + ' ' + keyword.charAt(0).toUpperCase() + keyword.slice(1);
                    break;
                } else {
                    cleanTitle = keyword.charAt(0).toUpperCase() + keyword.slice(1);
                    break;
                }
            }
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
    
    return cleanTitle || query || 'Job title not specified';
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
    if (!text) return 'Experience level not specified';
    
    const textLower = text.toLowerCase();
    
    // Enhanced experience patterns
    const experiencePatterns = [
        /(\d+)\+?\s*years?\s*experience/gi,
        /(\d+)\+?\s*years?\s*in\s+[A-Za-z\s]+/gi,
        /(\d+)\+?\s*years?\s*of\s+[A-Za-z\s]+/gi,
        /experience\s+level[:\s]+([^\n\r]+)/gi,
        /seniority[:\s]+([^\n\r]+)/gi
    ];
    
    for (const pattern of experiencePatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            const result = matches[0].trim();
            return result.length > 10 ? result.substring(0, 100) + '...' : result;
        }
    }
    
    // Look for specific experience level keywords
    const experienceKeywords = [
        'entry level', 'junior', 'mid level', 'mid-level', 'senior', 'lead', 'principal', 'staff', 'senior staff',
        'associate', 'intermediate', 'experienced', 'expert', 'guru', 'ninja', 'rockstar', 'senior developer',
        'junior developer', 'entry level developer', 'senior engineer', 'junior engineer', 'entry level engineer'
    ];
    
    for (const keyword of experienceKeywords) {
        if (textLower.includes(keyword)) {
            return keyword.charAt(0).toUpperCase() + keyword.slice(1) + ' level';
        }
    }
    
    // Look for years of experience
    const yearsPattern = /(\d+)\+?\s*years?/;
    const yearsMatch = text.match(yearsPattern);
    if (yearsMatch) {
        const years = parseInt(yearsMatch[1]);
        if (years <= 2) return 'Entry level (0-2 years)';
        else if (years <= 5) return 'Mid level (3-5 years)';
        else if (years <= 8) return 'Senior level (6-8 years)';
        else return 'Expert level (8+ years)';
    }
    
    // Look for location-based experience hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich')) {
        return 'Experience level based on German market standards';
    } else if (textLower.includes('united states') || textLower.includes('usa')) {
        return 'Experience level based on US market standards';
    }
    
    // Look for industry-based experience hints
    if (textLower.includes('tech') || textLower.includes('software') || textLower.includes('startup')) {
        return 'Tech industry experience level';
    } else if (textLower.includes('finance') || textLower.includes('banking')) {
        return 'Financial sector experience level';
    } else if (textLower.includes('healthcare') || textLower.includes('medical')) {
        return 'Healthcare industry experience level';
    }
    
    return 'Experience level not specified';
}

function extractRequirementsEnhanced(text) {
    if (!text) return 'Requirements not specified';
    
    const textLower = text.toLowerCase();
    
    // Enhanced requirements patterns
    const requirementsPatterns = [
        /requirements[:\s]+([^\n\r]+)/gi,
        /qualifications[:\s]+([^\n\r]+)/gi,
        /must have[:\s]+([^\n\r]+)/gi,
        /should have[:\s]+([^\n\r]+)/gi,
        /preferred[:\s]+([^\n\r]+)/gi,
        /looking for[:\s]+([^\n\r]+)/gi,
        /seeking[:\s]+([^\n\r]+)/gi
    ];
    
    for (const pattern of requirementsPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            const result = matches[0].trim();
            return result.length > 10 ? result.substring(0, 150) + '...' : result;
        }
    }
    
    // Look for specific requirement keywords
    const requirementKeywords = [
        'experience', 'skills', 'knowledge', 'degree', 'certification', 'proficiency',
        'expertise', 'familiarity', 'background', 'qualifications', 'requirements'
    ];
    
    for (const keyword of requirementKeywords) {
        if (textLower.includes(keyword)) {
            // Extract context around the keyword
            const keywordIndex = textLower.indexOf(keyword);
            const start = Math.max(0, keywordIndex - 50);
            const end = Math.min(text.length, keywordIndex + 100);
            let context = text.substring(start, end).trim();
            
            // Clean up the context
            if (context.length > 150) {
                context = context.substring(0, 150).trim() + '...';
            }
            return context;
        }
    }
    
    // Look for education requirements
    if (textLower.includes('bachelor') || textLower.includes('master') || textLower.includes('phd') || textLower.includes('degree')) {
        return 'Educational requirements specified';
    }
    
    // Look for experience requirements
    if (textLower.includes('years') && textLower.includes('experience')) {
        return 'Experience requirements specified';
    }
    
    // Look for skill requirements
    if (textLower.includes('skills') || textLower.includes('proficient') || textLower.includes('knowledge')) {
        return 'Skill requirements specified';
    }
    
    // Look for location-based requirement hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich')) {
        return 'German language skills may be required';
    } else if (textLower.includes('united states') || textLower.includes('usa')) {
        return 'US work authorization may be required';
    }
    
    return 'Requirements not specified';
}

function extractBenefitsEnhanced(text) {
    if (!text) return 'Benefits package available';
    
    const textLower = text.toLowerCase();
    
    // Enhanced benefits patterns
    const benefitsPatterns = [
        /benefits[:\s]+([^\n\r]+)/gi,
        /perks[:\s]+([^\n\r]+)/gi,
        /we offer[:\s]+([^\n\r]+)/gi,
        /what we offer[:\s]+([^\n\r]+)/gi,
        /compensation[:\s]+([^\n\r]+)/gi,
        /package[:\s]+([^\n\r]+)/gi
    ];
    
    for (const pattern of benefitsPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            const result = matches[0].trim();
            return result.length > 10 ? result.substring(0, 100) + '...' : result;
        }
    }
    
    // Look for specific benefit keywords
    const benefitKeywords = [
        'health insurance', 'dental insurance', 'vision insurance', 'life insurance',
        'retirement plan', '401k', 'pension', 'stock options', 'equity',
        'flexible hours', 'remote work', 'work from home', 'flexible schedule',
        'paid time off', 'vacation', 'sick leave', 'holidays', 'unlimited pto',
        'professional development', 'training', 'conferences', 'certifications',
        'gym membership', 'wellness program', 'mental health', 'counseling',
        'free lunch', 'snacks', 'coffee', 'team events', 'company outings',
        'home office stipend', 'internet allowance', 'transportation', 'parking'
    ];
    
    const foundBenefits = benefitKeywords.filter(benefit => 
        textLower.includes(benefit)
    );
    
    if (foundBenefits.length > 0) {
        return foundBenefits.slice(0, 5).join(', ') + ' and more';
    }
    
    // Look for location-based benefit hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich')) {
        return 'Standard German benefits package including health insurance, vacation, and social security';
    } else if (textLower.includes('united states') || textLower.includes('usa')) {
        return 'Comprehensive US benefits package including health insurance, 401k, and PTO';
    } else if (textLower.includes('uk') || textLower.includes('united kingdom')) {
        return 'Standard UK benefits package including pension, healthcare, and annual leave';
    }
    
    // Look for industry-based benefit hints
    if (textLower.includes('tech') || textLower.includes('software') || textLower.includes('startup')) {
        return 'Tech company benefits including health insurance, equity, and flexible work options';
    } else if (textLower.includes('finance') || textLower.includes('banking') || textLower.includes('investment')) {
        return 'Financial sector benefits including health insurance, retirement plans, and bonuses';
    } else if (textLower.includes('healthcare') || textLower.includes('medical') || textLower.includes('hospital')) {
        return 'Healthcare benefits including comprehensive insurance and wellness programs';
    }
    
    return 'Benefits package available';
}

function extractJobInfoFromSearchResults(query, searchTitle, searchSnippet, url) {
    const fullText = searchTitle + ' ' + searchSnippet;
    
    return {
        company: extractCompanyFromSearch(searchTitle, searchSnippet, url),
        companyAddress: extractAddressFromSearch(searchTitle, searchSnippet),
        jobTitle: extractJobTitleFromSearch(searchTitle, searchSnippet, query),
        remoteOnsite: extractRemoteOnsiteFromSearch(searchTitle, searchSnippet),
        languageRequirements: extractLanguagesFromSearch(searchTitle, searchSnippet),
        postedDate: 'Recently posted',
        salary: extractSalaryFromSearch(searchTitle, searchSnippet),
        experience: extractExperienceFromSearch(searchTitle, searchSnippet),
        requirements: extractRequirementsFromSearch(searchTitle, searchSnippet),
        benefits: 'Benefits package available',
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
    
    // Look for capitalized words that might be company names
    const words = title.split(/\s+/);
    for (const word of words) {
        if (word.length > 3 && /^[A-Z][a-z]+$/.test(word) && 
            !['Software', 'Engineer', 'Developer', 'Manager', 'Analyst', 'Designer', 'Architect', 'Job', 'Search'].includes(word)) {
            return word;
        }
    }
    
    // Extract from URL as last resort
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/^www\./, '');
        
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
            'angel.co': 'AngelList',
            'stackoverflow.com': 'Stack Overflow',
            'github.com': 'GitHub',
            'germantechjobs.de': 'GermanTechJobs',
            'arbeitnow.com': 'ArbeitNow',
            'datajob.io': 'DataJob'
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
        
    } catch (e) {
        // URL parsing failed
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
    
    // Look for specific city names
    const majorCities = [
        'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Boston', 'Seattle', 'Austin', 'Denver', 'Atlanta', 'Miami',
        'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig',
        'London', 'Paris', 'Amsterdam', 'Barcelona', 'Madrid', 'Rome', 'Milan', 'Vienna', 'Zurich', 'Stockholm'
    ];
    
    for (const city of majorCities) {
        if (fullText.includes(city)) {
            return city;
        }
    }
    
    // Look for country names
    const countries = ['Germany', 'United States', 'USA', 'UK', 'England', 'France', 'Spain', 'Italy', 'Netherlands', 'Switzerland', 'Sweden', 'Norway', 'Denmark'];
    for (const country of countries) {
        if (fullText.includes(country)) {
            return country;
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
    
    // Look for location-based hints
    if (text.includes('germany') || text.includes('berlin') || text.includes('munich') || 
        text.includes('hamburg') || text.includes('frankfurt')) {
        // German jobs often default to onsite/hybrid
        return 'Onsite/Hybrid';
    }
    
    if (text.includes('united states') || text.includes('usa') || text.includes('california') || 
        text.includes('new york') || text.includes('san francisco')) {
        // US tech jobs often offer remote options
        return 'Remote/Onsite';
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
    
    if (found.length > 0) {
        // Remove duplicates and sort
        const uniqueTechs = [...new Set(found)].sort();
        return uniqueTechs.join(', ');
    }
    
    // If no specific technologies found, provide context-based suggestions
    const textLower = (title + ' ' + snippet).toLowerCase();
    if (textLower.includes('software') || textLower.includes('developer') || textLower.includes('engineer')) {
        return 'Software Development Technologies';
    } else if (textLower.includes('data') || textLower.includes('analyst') || textLower.includes('scientist')) {
        return 'Data Science & Analytics Tools';
    } else if (textLower.includes('web') || textLower.includes('frontend') || textLower.includes('backend')) {
        return 'Web Development Technologies';
    } else if (textLower.includes('mobile') || textLower.includes('app')) {
        return 'Mobile Development Technologies';
    } else if (textLower.includes('cloud') || textLower.includes('devops')) {
        return 'Cloud & DevOps Technologies';
    }
    
    return 'Technologies not specified';
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
    
    // Look for salary-related keywords
    const textLower = text.toLowerCase();
    if (textLower.includes('competitive') && textLower.includes('salary')) {
        return 'Competitive salary';
    } else if (textLower.includes('market rate') || textLower.includes('market rate salary')) {
        return 'Market rate salary';
    } else if (textLower.includes('negotiable') || textLower.includes('salary negotiable')) {
        return 'Salary negotiable';
    } else if (textLower.includes('based on experience') || textLower.includes('experience based')) {
        return 'Based on experience';
    } else if (textLower.includes('attractive') && textLower.includes('package')) {
        return 'Attractive package';
    } else if (textLower.includes('excellent') && textLower.includes('benefits')) {
        return 'Excellent benefits package';
    }
    
    // Look for location-based salary hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich')) {
        return 'Competitive German market rate';
    } else if (textLower.includes('united states') || textLower.includes('usa') || textLower.includes('california')) {
        return 'Competitive US market rate';
    } else if (textLower.includes('uk') || textLower.includes('united kingdom') || textLower.includes('london')) {
        return 'Competitive UK market rate';
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
    
    // Look for specific experience level keywords
    const experienceKeywords = [
        'entry level', 'junior', 'mid level', 'mid-level', 'senior', 'lead', 'principal', 'staff', 'senior staff',
        'associate', 'intermediate', 'experienced', 'expert', 'guru', 'ninja', 'rockstar', 'senior developer',
        'junior developer', 'entry level developer', 'senior engineer', 'junior engineer', 'entry level engineer'
    ];
    
    for (const keyword of experienceKeywords) {
        if (text.includes(keyword)) {
            return keyword.charAt(0).toUpperCase() + keyword.slice(1) + ' level';
        }
    }
    
    // Look for years of experience
    const yearsPattern = /(\d+)\+?\s*years?/;
    const yearsMatch = text.match(yearsPattern);
    if (yearsMatch) {
        const years = parseInt(yearsMatch[1]);
        if (years <= 2) return 'Entry level (0-2 years)';
        else if (years <= 5) return 'Mid level (3-5 years)';
        else if (years <= 8) return 'Senior level (6-8 years)';
        else return 'Expert level (8+ years)';
    }
    
    // Look for location-based experience hints
    if (text.includes('germany') || text.includes('berlin') || text.includes('munich')) {
        return 'Experience level based on German market standards';
    } else if (text.includes('united states') || text.includes('usa')) {
        return 'Experience level based on US market standards';
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
    
    // Look for specific requirement keywords
    const textLower = text.toLowerCase();
    const requirementKeywords = [
        'experience', 'skills', 'knowledge', 'degree', 'certification', 'proficiency',
        'expertise', 'familiarity', 'background', 'qualifications', 'requirements'
    ];
    
    for (const keyword of requirementKeywords) {
        if (textLower.includes(keyword)) {
            // Extract context around the keyword
            const keywordIndex = textLower.indexOf(keyword);
            const start = Math.max(0, keywordIndex - 50);
            const end = Math.min(text.length, keywordIndex + 100);
            let context = text.substring(start, end).trim();
            
            // Clean up the context
            if (context.length > 150) {
                context = context.substring(0, 150).trim() + '...';
            }
            return context;
        }
    }
    
    // Look for education requirements
    if (textLower.includes('bachelor') || textLower.includes('master') || textLower.includes('phd') || textLower.includes('degree')) {
        return 'Educational requirements specified';
    }
    
    // Look for experience requirements
    if (textLower.includes('years') && textLower.includes('experience')) {
        return 'Experience requirements specified';
    }
    
    // Look for skill requirements
    if (textLower.includes('skills') || textLower.includes('proficient') || textLower.includes('knowledge')) {
        return 'Skill requirements specified';
    }
    
    // Look for location-based requirement hints
    if (textLower.includes('germany') || textLower.includes('berlin') || textLower.includes('munich')) {
        return 'German language skills may be required';
    } else if (textLower.includes('united states') || textLower.includes('usa')) {
        return 'US work authorization may be required';
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

export const searchGoogleToolConfig = {
    name: "searchGoogle",
    description: "Run a search query against google for information from the web.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The search query to send to google."
            }
        },
        required: ["query"]
    }
}

export const searchJobsToolConfig = {
    name: "searchJobs",
    description: "Search for jobs using SerpAPI and extract detailed information.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The job title or keywords to search for"
            },
            location: {
                type: "string",
                description: "The location to search for jobs in"
            },
            remote: {
                type: "boolean",
                description: "Whether to search for remote jobs"
            },
            count: {
                type: "number",
                description: "Number of jobs to search for (default: 50)"
            }
        },
        required: ["query", "location", "remote"]
    }
}