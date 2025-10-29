

import { GoogleGenAI } from "@google/genai";
import readline from 'readline';
import fs from 'fs/promises';
import chalk from 'chalk';

// --- CONFIGURATION ---
const STATE_FILE = 'scraper-state.json';
const PROMPT_CHAR = chalk.green('>');

// --- STATE MANAGEMENT ---
let state = {
  sites: [],
  excludedSites: [],
  morningQuery: 'What are the top 3 latest news in technology?',
};

async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    const loadedState = JSON.parse(data);
    // Ensure new state properties exist
    state = {
      sites: [],
      excludedSites: [],
      ...loadedState
    };
  } catch (error) {
    // If file doesn't exist, it will be created on first save.
    if (error.code !== 'ENOENT') {
      console.error(chalk.red('Error loading state:'), error);
    }
  }
}

async function saveState() {
  try {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error(chalk.red('Error saving state:'), error);
  }
}


// --- GEMINI SERVICE ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function scrapeWithGrounding(query, sites, excludedSites) {
  const MAX_RETRIES = 3;
  let delay = 1000; // Start with 1 second

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const model = 'gemini-2.5-flash';
      
      // Construct a Google Search query with priority sites and excluded sites.
      const siteSearchQuery = sites.map(site => `site:${site.trim()}`).join(' OR ');
      const excludeQuery = excludedSites.map(site => `-site:${site.trim()}`).join(' ');
      const fullQuery = `${query} ${siteSearchQuery} ${excludeQuery}`.trim();

      const systemInstruction = `
You are a specialized news extraction assistant. Your task is to answer the user's query based ONLY on the information returned by a site-restricted Google Search.

**Your instructions are**:
1.  **Strict Source Adherence**: Provide an answer synthesized exclusively from the search results. DO NOT use any other information or websites.
2.  **Recency Requirement**: Prioritize information published within the last 48 hours.
3.  **Mandatory Citation**: You MUST cite the specific article title and URL for all pieces of information in your answer.
4.  **Failure Condition**: If the search results do not contain a relevant answer from the last 48 hours, you MUST respond with the exact phrase: "The requested information could not be found on the provided websites within the last 48 hours." Do not apologize or add extra text.
`.trim();

      const response = await ai.models.generateContent({
        model: model,
        contents: fullQuery,
        config: {
          systemInstruction: systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      const sources = groundingChunks
        ?.map(chunk => chunk.web)
        .filter((web) => !!web && !!web.uri)
        .reduce((acc, current) => {
          if (!acc.find(item => item.uri === current.uri)) {
            acc.push(current);
          }
          return acc;
        }, []) || [];

      return { text, sources }; // Success, exit the loop.

    } catch (error) {
      if (error?.status === 503 && i < MAX_RETRIES - 1) {
        console.log(chalk.yellow(`Model is overloaded. Retrying in ${delay / 1000}s... (${i + 1}/${MAX_RETRIES})`));
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue; // Go to the next iteration of the loop
      }

      console.error(chalk.red("Error calling Gemini API:"), error);
      if (error instanceof Error) {
          if (error.message.includes('API key not valid')) {
              throw new Error('The provided API key is not valid. Please check your environment configuration.');
          }
      }
      if (error?.status === 503) {
        throw new Error('The model is currently overloaded. Please try again later.');
      }
      throw new Error("Failed to fetch data from Gemini API.");
    }
  }
  // This should not be reached if MAX_RETRIES > 0, but is a fallback.
  throw new Error("Failed to fetch data from Gemini API after multiple retries.");
}

// --- UI & COMMANDS ---

let animationSpinner;

function showProcessingAnimation(text = 'Processing') {
  const frames = ['|', '/', '-', '\\'];
  let i = 0;
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(chalk.yellow(`${frames[i]} ${text}`));

  animationSpinner = setInterval(() => {
    i = (i + 1) % frames.length;
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(chalk.yellow(`${frames[i]} ${text}`));
  }, 100);
}

function stopProcessingAnimation() {
  clearInterval(animationSpinner);
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

// Helper to wrap text to a specific width
function wordWrap(text, maxWidth) {
  if (!text) return '';
  const lines = [];
  const paragraphs = text.split('\n');
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length > maxWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines.join('\n');
}

function displayResults(title, result) {
  const termWidth = process.stdout.columns || 80;
  const contentWidth = termWidth - 4; // Space for '│ ' and ' │'
  
  const borderColor = chalk.cyan;
  const titleColor = chalk.yellow.bold;
  const textColor = chalk.white;
  const sourceTitleColor = chalk.hex('#FFA500').bold; // Orange
  const sourceTextColor = chalk.white;
  const linkColor = chalk.cyan.underline;

  // Helper to print a line within the box
  const printLine = (content = '', color = textColor) => {
    console.log(borderColor('│ ') + color(content.padEnd(contentWidth)) + borderColor(' │'));
  };

  // Top Border
  console.log(borderColor(`┌${'─'.repeat(contentWidth + 2)}┐`));
  
  // Title
  const wrappedTitle = wordWrap(title, contentWidth);
  wrappedTitle.split('\n').forEach(line => printLine(line, titleColor));

  // Separator
  console.log(borderColor(`├${'─'.repeat(contentWidth + 2)}┤`));
  
  printLine(); // Spacer

  // Body
  const wrappedText = wordWrap(result.text, contentWidth);
  wrappedText.split('\n').forEach(line => printLine(line, textColor));
  
  // Sources
  if (result.sources && result.sources.length > 0) {
    printLine(); // Spacer
    printLine('SOURCES:', sourceTitleColor);
    result.sources.forEach(source => {
        printLine(); // Spacer between sources
        const titleLines = wordWrap(source.title || 'Untitled', contentWidth - 2); // Indent
        titleLines.split('\n').forEach(line => printLine('  ' + line, sourceTextColor));
      
        const linkLines = wordWrap(source.uri, contentWidth - 2); // Indent
        linkLines.split('\n').forEach(line => printLine('  ' + line, linkColor));
    });
  }

  // Bottom Border
  console.log(borderColor(`└${'─'.repeat(contentWidth + 2)}┘`));
}


function showWelcomeMessage() {
  console.log(chalk.green(`
   _____                      _      __          __     ____    __ 
  / ____|                    (_)    / _|         \\ \\   / /_ |  / / 
 | |  __  _ __ ___   ___ _ __ _ ___| |_ ___ _ __  \\ \\_/ / | | / /  
 | | |_ |/ __/ _ \\ / __| '__| / __|  _/ _ \\ '__|  \\   /  | |/ /   
 | |__| | (_| (_) | (__| |  | \\__ \\ ||  __/ |      | |   | / /    
  \\_____|\\___\\___/ \\___|_|  |_|___/_| \\___|_|      |_|   |_/_/     
                                                                 
`));
  console.log('Welcome to the Gemini Web Scraper CLI.');
  console.log('This tool uses Google Search grounding to scrape and verify information.');
  console.log(`Type ${chalk.yellow('help')} to see a list of available commands.`);
  console.log();
}

function showHelp() {
  const pad = (str) => str.padEnd(32);
  console.log(chalk.yellow.bold('Available Commands:'));
  console.log(chalk.yellow.bold('\n-- Site Management --'));
  console.log(`  ${chalk.cyan(pad('add-site <url1> [url2]...'))} - Adds site(s) to the priority list.`);
  console.log(`  ${chalk.cyan(pad('list-sites'))} - Lists all priority websites.`);
  console.log(`  ${chalk.cyan(pad('remove-site <url>'))} - Removes a site from the priority list.`);
  console.log(`  ${chalk.cyan(pad('clear-sites'))} - Clears the priority site list.`);
  console.log(chalk.yellow.bold('\n-- Exclusion Management --'));
  console.log(`  ${chalk.cyan(pad('add-exclude <url1> [url2]...'))} - Adds site(s) to the exclusion list.`);
  console.log(`  ${chalk.cyan(pad('list-excludes'))} - Lists all excluded websites.`);
  console.log(`  ${chalk.cyan(pad('remove-exclude <url>'))} - Removes a site from the exclusion list.`);
  console.log(`  ${chalk.cyan(pad('clear-excludes'))} - Clears the exclusion list.`);
  console.log(chalk.yellow.bold('\n-- Scraping --'));
  console.log(`  ${chalk.cyan(pad('scrape <query>'))} - Scrapes saved sites for the given query.`);
  console.log(`  ${chalk.cyan(pad('set-morning-query <query>'))} - Sets the default query for the morning scrape.`);
  console.log(`  ${chalk.cyan(pad('scrape-morning'))} - Runs the predefined morning scrape query.`);
  console.log(chalk.yellow.bold('\n-- General --'));
  console.log(`  ${chalk.cyan(pad('help'))} - Shows this help message.`);
  console.log(`  ${chalk.cyan(pad('clear'))} - Clears the terminal screen.`);
  console.log(`  ${chalk.cyan(pad('exit'))} - Exits the application.`);
}

async function processCommand(line) {
  const [cmd, ...args] = line.trim().split(' ');
  if (!cmd) return;

  switch (cmd.toLowerCase()) {
    case 'help':
      showHelp();
      break;

    case 'add-site':
      if (args.length > 0) {
        const added = [], duplicates = [];
        args.forEach(s => state.sites.includes(s) ? duplicates.push(s) : added.push(s));
        if (added.length > 0) {
          state.sites.push(...added);
          await saveState();
          console.log(chalk.green('Priority sites added:'), added.join(', '));
        }
        if (duplicates.length > 0) console.log(chalk.yellow('Sites already existed:'), duplicates.join(', '));
      } else {
        console.log("Usage: add-site <url1> [url2]...");
      }
      break;

    case 'list-sites':
      if (state.sites.length > 0) {
        console.log(chalk.bold('Priority sites:'));
        state.sites.forEach(site => console.log(`- ${site}`));
      } else {
        console.log("No priority sites saved.");
      }
      break;

    case 'remove-site':
      if (args.length > 0) {
        const siteToRemove = args[0];
        if (state.sites.includes(siteToRemove)) {
          state.sites = state.sites.filter(site => site !== siteToRemove);
          await saveState();
          console.log(`Site removed: ${siteToRemove}`);
        } else {
          console.log(`Site not found in priority list: ${siteToRemove}`);
        }
      } else {
        console.log("Usage: remove-site <url>");
      }
      break;
    
    case 'clear-sites':
      if (state.sites.length > 0) {
        state.sites = [];
        await saveState();
        console.log(chalk.green('All priority sites have been cleared.'));
      } else {
        console.log('Priority site list is already empty.');
      }
      break;

    case 'add-exclude':
        if (args.length > 0) {
          const added = [], duplicates = [];
          args.forEach(s => state.excludedSites.includes(s) ? duplicates.push(s) : added.push(s));
          if (added.length > 0) {
            state.excludedSites.push(...added);
            await saveState();
            console.log(chalk.green('Excluded sites added:'), added.join(', '));
          }
          if (duplicates.length > 0) console.log(chalk.yellow('Sites already excluded:'), duplicates.join(', '));
        } else {
          console.log("Usage: add-exclude <url1> [url2]...");
        }
        break;

    case 'list-excludes':
        if (state.excludedSites.length > 0) {
            console.log(chalk.bold('Excluded sites:'));
            state.excludedSites.forEach(site => console.log(`- ${site}`));
        } else {
            console.log("No sites excluded.");
        }
        break;

    case 'remove-exclude':
        if (args.length > 0) {
            const siteToRemove = args[0];
            if (state.excludedSites.includes(siteToRemove)) {
                state.excludedSites = state.excludedSites.filter(site => site !== siteToRemove);
                await saveState();
                console.log(`Site removed from exclusion list: ${siteToRemove}`);
            } else {
                console.log(`Site not found in exclusion list: ${siteToRemove}`);
            }
        } else {
            console.log("Usage: remove-exclude <url>");
        }
        break;

    case 'clear-excludes':
        if (state.excludedSites.length > 0) {
            state.excludedSites = [];
            await saveState();
            console.log(chalk.green('Exclusion list has been cleared.'));
        } else {
            console.log('Exclusion list is already empty.');
        }
        break;

    case 'set-morning-query': {
      const query = args.join(' ');
      if (!query) {
          console.log("Usage: set-morning-query <query>");
          break;
      }
      state.morningQuery = query;
      await saveState();
      console.log(`Morning query set to: "${query}"`);
      break;
    }

    case 'scrape':
    case 'scrape-morning':
      if (state.sites.length === 0) {
        console.log(chalk.red('Error: No priority sites to scrape. Please add a site using the "add-site <url>" command first.'));
        break;
      }
      const isMorningScrape = cmd.toLowerCase() === 'scrape-morning';
      const query = isMorningScrape ? state.morningQuery : args.join(' ');
      
      if (!query) {
          console.log("Usage: scrape <query>");
          break;
      }
      
      showProcessingAnimation('Scraping the web with Gemini...');
      try {
          const result = await scrapeWithGrounding(query, state.sites, state.excludedSites);
          stopProcessingAnimation();
          const title = isMorningScrape ? `Morning Scrape: "${query}"` : `Query: "${query}"`;
          displayResults(title, result);
      } catch (error) {
          stopProcessingAnimation();
          console.error(chalk.red(`Error: ${error.message}`));
      }
      break;

    case 'clear':
      console.clear();
      showWelcomeMessage(); // Show welcome again after clearing
      break;

    case 'exit':
      return true; // Signal to exit

    default:
      console.log(`Command not found: ${cmd}. Type 'help' for a list of commands.`);
  }
  return false;
}

// --- MAIN APP LOOP ---
async function main() {
  if (!process.env.API_KEY) {
    console.error(chalk.red.bold('ERROR: API_KEY environment variable not set.'));
    console.error('Please set your Gemini API key and restart the application.');
    process.exit(1);
  }
  
  await loadState();
  
  console.clear();
  showWelcomeMessage();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${PROMPT_CHAR} `,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const shouldExit = await processCommand(line);
    if (shouldExit) {
      rl.close();
    } else {
      console.log(); // Add a blank line for spacing
      rl.prompt();
    }
  }).on('close', () => {
    console.log(chalk.yellow('\nExiting Scraper CLI. Goodbye!'));
    process.exit(0);
  });
}

main();
