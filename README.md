# site2pdf

This tool generates a PDF file containing the main page and all sub-pages of a website that match a provided URL pattern.

**The PDF generated by this tool is particularly well-suited for AI RAG QA purposes.**

## Installation

```bash
npm install
```

## Usage

```bash
npm start -- <main_url> [url_pattern]
```

### Arguments

* `<main_url>`: The main URL of the website to be converted to PDF.
* `[url_pattern]`: Optional regular expression to filter sub-links. Defaults to matching only links within the main URL domain.

### Example

```bash
npm start -- 'https://www.typescriptlang.org/docs/handbook/' 'https://www.typescriptlang.org/docs/handbook/2/'
```

```bash
> site2pdf@1.0.0 start
> tsx index.ts https://www.typescriptlang.org/docs/handbook/ https://www.typescriptlang.org/docs/handbook/2/

Generating PDF for: https://www.typescriptlang.org/docs/handbook/
Generating PDF for: https://www.typescriptlang.org/docs/handbook/2/basic-types.html
Generating PDF for: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
Generating PDF for: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
Generating PDF for: https://www.typescriptlang.org/docs/handbook/2/functions.html
Generating PDF for: https://www.typescriptlang.org/docs/handbook/2/objects.html
Generating PDF for: https://www.typescriptlang.org/docs/handbook/2/classes.html
Generating PDF for: https://www.typescriptlang.org/docs/handbook/2/modules.html
Generating PDF for: https://www.typescriptlang.org/docs/handbook/2/types-from-types.html
PDF saved to ./out/www-typescriptlang-org-docs-handbook.pdf
```

This command will generate a PDF file named `www.typescriptlang.org-docs-handbook.pdf` containing all pages on the `https://www.typescriptlang.org/docs/handbook/` domain that match the pattern `https://www.typescriptlang.org/docs/handbook/2/`.

## Implementation Details

* Navigates to the main page using `puppeteer`.
* Finds all sub-links matching the provided `url_pattern`.
* Generates a PDF for each sub-link using `pdf-lib` and merges them into a single document.
* Saves the final PDF file with a slugified name based on the main URL.
    
**Note:** The provided `url_pattern` should be a valid regular expression. If no `url_pattern` is provided, the tool will default to matching only links within the main URL domain.

This tool is still under development and may have limitations. Feel free to contribute to the project by opening issues or pull requests!

```markdown
## Development

### Prerequisites

Ensure you have Node.js and npm installed. You will also need a modern version of TypeScript and other dependencies specified in `package.json`.

### Setup

Clone the repository and install the dependencies:

```bash
git clone https://github.com/laiso/site2pdf.git
cd site2pdf
npm install
```

### Building

The project uses TypeScript. To compile the TypeScript files, run:

```bash
npx tsc
```

### Running the Project

You can run the project in development mode with:

```bash
npm run dev
```

This command uses `tsx` to watch for changes and recompile as necessary.

### Testing

The project uses Jest for testing. To run the tests, execute:

```bash
npm test
```

### Linting

Linting is configured using Biome. To check for linting issues, run:

```bash
npx biome lint
```

### Code Formatting

To format the code according to the project's style guidelines, run:

```bash
npx biome format
```

### Contributing

Feel free to open issues or pull requests. Make sure to follow the existing code style and include tests for new features or bug fixes.

### Notes

- The project uses ES modules. Ensure your Node.js version supports this.
- Update dependencies as necessary, and ensure compatibility with existing code.
