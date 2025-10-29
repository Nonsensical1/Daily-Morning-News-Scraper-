# Gemini Web Scraper CLI

A native command-line interface that uses Google's Gemini API with search grounding to scrape and verify information from user-provided websites.

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18.0.0 or higher)
- A Google Gemini API key.

## Setup

1.  **Save the files** (`cli.mjs`, `package.json`, `README.md`) into a new directory.

2.  **Install dependencies:**
    Open your terminal in the project directory and run:
    ```bash
    npm install
    ```

3.  **Set up your API Key:**
    You must set your Gemini API key as an environment variable. This is a critical step for the application to connect to the Gemini API.

    -   **macOS/Linux:**
        ```bash
        export API_KEY="YOUR_API_KEY_HERE"
        ```
        To make it permanent, add this line to your `~/.bashrc`, `~/.zshrc`, or other shell configuration file.

    -   **Windows (Command Prompt):**
        ```bash
        set API_KEY="YOUR_API_KEY_HERE"
        ```

    -   **Windows (PowerShell):**
        ```bash
        $env:API_KEY="YOUR_API_KEY_HERE"
        ```
    *Note: Environment variables set this way are only for the current terminal session. For a permanent solution on Windows, search for "Edit the system environment variables".*

## Running the Application

Once the setup is complete, run the CLI with the following command:

```bash
npm start
```

or directly with Node.js:

```bash
node cli.mjs
```

## Available Commands

-   `help`: Shows the help message.
-   `add-site <url>`: Adds a website URL to the scraping list.
-   `list-sites`: Lists all saved website URLs.
-   `remove-site <url>`: Removes a website URL from the list.
-   `scrape <query>`: Scrapes the web for the given query, prioritizing saved sites.
-   `set-morning-query <query>`: Sets the default query for the morning scrape.
-   `scrape-morning`: Runs the predefined morning scrape query.
-   `clear`: Clears the terminal screen.
-   `exit`: Exits the application.
