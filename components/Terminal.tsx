import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HistoryItem } from '../types';
import { scrapeWithGrounding } from '../services/geminiService';

const WelcomeMessage: React.FC = () => (
  <div className="text-green-400">
    <pre className="whitespace-pre-wrap">
{`
   _____                      _      __          __     ____    __ 
  / ____|                    (_)    / _|         \\ \\   / /_ |  / / 
 | |  __  _ __ ___   ___ _ __ _ ___| |_ ___ _ __  \\ \\_/ / | | / /  
 | | |_ |/ __/ _ \\ / __| '__| / __|  _/ _ \\ '__|  \\   /  | |/ /   
 | |__| | (_| (_) | (__| |  | \\__ \\ ||  __/ |      | |   | / /    
  \\_____|\\___\\___/ \\___|_|  |_|___/_| \\___|_|      |_|   |_/_/     
                                                                 
`}
    </pre>
    <p>Welcome to the Gemini Web Scraper CLI.</p>
    <p>This tool uses Google Search grounding to scrape and verify information.</p>
    <p>Type <span className="text-yellow-400">'help'</span> to see a list of available commands.</p>
    <br/>
  </div>
);

const Terminal: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sites, setSites] = useState<string[]>(() => {
    const savedSites = localStorage.getItem('scraper-sites');
    return savedSites ? JSON.parse(savedSites) : [];
  });
  const [excludedSites, setExcludedSites] = useState<string[]>(() => {
    const saved = localStorage.getItem('scraper-excluded-sites');
    return saved ? JSON.parse(saved) : [];
  });
  const [morningQuery, setMorningQuery] = useState<string>(() => {
      return localStorage.getItem('scraper-morning-query') || 'What are the top 3 latest news in technology?';
  });

  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('scraper-sites', JSON.stringify(sites));
  }, [sites]);

  useEffect(() => {
    localStorage.setItem('scraper-excluded-sites', JSON.stringify(excludedSites));
  }, [excludedSites]);

  useEffect(() => {
    localStorage.setItem('scraper-morning-query', morningQuery);
  }, [morningQuery]);


  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const processCommand = useCallback(async (command: string) => {
    const [cmd, ...args] = command.trim().split(' ');
    const newHistoryItem: HistoryItem = { command, output: '', isProcessing: true };
    setHistory(prev => [...prev, newHistoryItem]);

    let output: React.ReactNode = '';

    switch (cmd.toLowerCase()) {
      case 'help':
        const helpPad = (str: string, len: number) => str.padEnd(len);
        output = (
          <div className="text-gray-300 whitespace-pre-wrap">
            <p className="text-yellow-400 font-bold">Available Commands:</p>
            <p className="text-yellow-400 mt-2 font-semibold">-- Site Management --</p>
            <p><span className="text-cyan-400">{helpPad('add-site <url1> [url2]...', 30)}</span>- Adds site(s) to the priority list.</p>
            <p><span className="text-cyan-400">{helpPad('list-sites', 30)}</span>- Lists all priority websites.</p>
            <p><span className="text-cyan-400">{helpPad('remove-site <url>', 30)}</span>- Removes a site from the priority list.</p>
            <p><span className="text-cyan-400">{helpPad('clear-sites', 30)}</span>- Clears the priority site list.</p>
            <p className="text-yellow-400 mt-2 font-semibold">-- Exclusion Management --</p>
            <p><span className="text-cyan-400">{helpPad('add-exclude <url1> [url2]...', 30)}</span>- Adds site(s) to the exclusion list.</p>
            <p><span className="text-cyan-400">{helpPad('list-excludes', 30)}</span>- Lists all excluded websites.</p>
            <p><span className="text-cyan-400">{helpPad('remove-exclude <url>', 30)}</span>- Removes a site from the exclusion list.</p>
            <p><span className="text-cyan-400">{helpPad('clear-excludes', 30)}</span>- Clears the exclusion list.</p>
            <p className="text-yellow-400 mt-2 font-semibold">-- Scraping --</p>
            <p><span className="text-cyan-400">{helpPad('scrape <query>', 30)}</span>- Scrapes sites for the given query.</p>
            <p><span className="text-cyan-400">{helpPad('set-morning-query <query>', 30)}</span>- Sets the default query for the morning scrape.</p>
            <p><span className="text-cyan-400">{helpPad('scrape-morning', 30)}</span>- Runs the morning scrape query.</p>
            <p className="text-yellow-400 mt-2 font-semibold">-- General --</p>
            <p><span className="text-cyan-400">{helpPad('help', 30)}</span>- Shows this help message.</p>
            <p><span className="text-cyan-400">{helpPad('clear', 30)}</span>- Clears the terminal screen.</p>
          </div>
        );
        break;

      case 'add-site':
        if (args.length > 0) {
          const added: string[] = [];
          const duplicates: string[] = [];
          args.forEach(site => sites.includes(site) ? duplicates.push(site) : added.push(site));
          if (added.length > 0) setSites(prev => [...prev, ...added]);
          output = (
            <div>
              {added.length > 0 && <p className="text-green-400">Sites added: {added.join(', ')}</p>}
              {duplicates.length > 0 && <p className="text-yellow-400">Sites already existed: {duplicates.join(', ')}</p>}
            </div>
          );
        } else {
          output = "Usage: add-site <url1> [url2]...";
        }
        break;

      case 'list-sites':
        output = sites.length > 0 ? (
          <div><p className="font-bold">Priority sites:</p><ul className="list-disc list-inside">{sites.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        ) : "No priority sites saved.";
        break;
        
      case 'remove-site':
        if (args.length > 0) {
            const siteToRemove = args[0];
            if (sites.includes(siteToRemove)) {
                setSites(prev => prev.filter(site => site !== siteToRemove));
                output = `Site removed: ${siteToRemove}`;
            } else {
                output = `Site not found: ${siteToRemove}`;
            }
        } else {
            output = "Usage: remove-site <url>";
        }
        break;
        
      case 'clear-sites':
        if (sites.length > 0) {
          setSites([]);
          output = 'All priority sites have been cleared.';
        } else {
          output = 'Priority site list is already empty.';
        }
        break;
      
      case 'add-exclude':
        if (args.length > 0) {
            const added = [];
            const duplicates = [];
            args.forEach(site => excludedSites.includes(site) ? duplicates.push(site) : added.push(site));
            if (added.length > 0) setExcludedSites(prev => [...prev, ...added]);
            output = (
              <div>
                {added.length > 0 && <p className="text-green-400">Excluded sites added: {added.join(', ')}</p>}
                {duplicates.length > 0 && <p className="text-yellow-400">Sites already excluded: {duplicates.join(', ')}</p>}
              </div>
            );
        } else {
            output = "Usage: add-exclude <url1> [url2]...";
        }
        break;

      case 'list-excludes':
        output = excludedSites.length > 0 ? (
          <div><p className="font-bold">Excluded sites:</p><ul className="list-disc list-inside">{excludedSites.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        ) : "No sites excluded.";
        break;

      case 'remove-exclude':
        if (args.length > 0) {
            const siteToRemove = args[0];
            if (excludedSites.includes(siteToRemove)) {
                setExcludedSites(prev => prev.filter(site => site !== siteToRemove));
                output = `Site removed from exclusion list: ${siteToRemove}`;
            } else {
                output = `Site not found in exclusion list: ${siteToRemove}`;
            }
        } else {
            output = "Usage: remove-exclude <url>";
        }
        break;
      
      case 'clear-excludes':
        if (excludedSites.length > 0) {
          setExcludedSites([]);
          output = 'Exclusion list has been cleared.';
        } else {
          output = 'Exclusion list is already empty.';
        }
        break;

      case 'scrape': {
        if (sites.length === 0) {
          output = 'Error: No priority sites to scrape. Please add a site using "add-site <url>" first.';
          break;
        }
        const query = args.join(' ');
        if (!query) {
            output = "Usage: scrape <query>";
            break;
        }
        try {
            const result = await scrapeWithGrounding(query, sites, excludedSites);
            output = (
              <div>
                <p className="whitespace-pre-wrap">{result.text}</p>
                {result.sources && result.sources.length > 0 && (
                  <div className="mt-4">
                    <p className="font-bold text-yellow-400">Sources:</p>
                    <ul className="list-disc list-inside">
                      {result.sources.map((source, index) => (
                        <li key={index}>
                          <p className="font-semibold">{source.title || 'Untitled'}</p>
                          <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                            {source.uri}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
        } catch (error) {
            output = `Error: ${(error as Error).message}`;
        }
        break;
      }
      
      case 'set-morning-query': {
        const query = args.join(' ');
        if (!query) {
            output = "Usage: set-morning-query <query>";
            break;
        }
        setMorningQuery(query);
        output = `Morning query set to: "${query}"`;
        break;
      }

      case 'scrape-morning': {
        if (sites.length === 0) {
          output = 'Error: No priority sites to scrape. Please add a site using "add-site <url>" first.';
          break;
        }
        try {
            const result = await scrapeWithGrounding(morningQuery, sites, excludedSites);
            output = (
              <div>
                <p className="font-bold text-yellow-400">Morning Scrape Results for: "{morningQuery}"</p>
                <p className="whitespace-pre-wrap mt-2">{result.text}</p>
                {result.sources && result.sources.length > 0 && (
                  <div className="mt-4">
                    <p className="font-bold text-yellow-400">Sources:</p>
                    <ul className="list-disc list-inside">
                      {result.sources.map((source, index) => (
                         <li key={index}>
                          <p className="font-semibold">{source.title || 'Untitled'}</p>
                          <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                            {source.uri}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
        } catch (error) {
            output = `Error: ${(error as Error).message}`;
        }
        break;
      }

      case 'clear':
        setHistory([]);
        return; // Early return to avoid adding to history

      default:
        output = `Command not found: ${cmd}. Type 'help' for a list of commands.`;
    }

    setHistory(prev =>
      prev.map(item =>
        item.command === command ? { ...item, output, isProcessing: false } : item
      )
    );
  }, [sites, morningQuery, excludedSites]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === '') return;
    processCommand(input);
    setInput('');
  };

  return (
    <div 
      className="w-full h-[60vh] md:h-[70vh] bg-gray-800 rounded-lg p-4 overflow-y-auto flex flex-col shadow-2xl"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-grow">
        <WelcomeMessage />
        {history.map((item, index) => (
          <div key={index} className="mb-2">
            <div className="flex items-center">
              <span className="text-green-400 mr-2">&gt;</span>
              <span className="text-gray-300">{item.command}</span>
            </div>
            <div className="pl-4 text-gray-300">
              {item.isProcessing ? (
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                item.output
              )}
            </div>
          </div>
        ))}
        <div ref={endOfHistoryRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex items-center mt-auto">
        <span className="text-green-400 mr-2">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full bg-transparent text-gray-300 border-none focus:outline-none focus:ring-0"
          autoFocus
          autoComplete="off"
        />
      </form>
    </div>
  );
};

export default Terminal;
