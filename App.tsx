
import React from 'react';
import Terminal from './components/Terminal';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white font-mono p-4 flex flex-col">
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-green-400">Gemini Web Scraper CLI</h1>
        <p className="text-gray-400">Utilizing Google Search grounding to verify information from the web.</p>
      </header>
      <main className="flex-grow">
        <Terminal />
      </main>
    </div>
  );
};

export default App;
