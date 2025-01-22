import { Buffer } from 'node:buffer';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import pLimit from 'p-limit';
import { PDFDocument } from 'pdf-lib';
import chromeFinder from 'chrome-finder';
function showHelp() {
	console.log(`
Usage: site2pdf-cli <main_url> [url_pattern]
Arguments:
  main_url         The main URL to generate PDF from
  url_pattern      (Optional) Regular expression pattern to match sub-links (default: ^main_url)
`);
}
type BrowserContext = {
	browser: Browser;
	page: Page;
};
async function useBrowserContext() {
	const browser = await puppeteer.launch({
		headless: true,
		executablePath: chromeFinder(),
	});
	const page = (await browser.pages())[0];
	return {
		browser,
		page,
	};
}
async function preparePageForAI(page: Page) {
	await page.evaluate(() => {
		// Remove all non-essential elements
		const removeSelectors = [
			'img',
			'svg',
			'video',
			'canvas',
			'audio',
			'style',
			'script',
			'noscript',
			'iframe',
			'nav',
			'header',
			'footer',
			'aside',
			'.ad',
			'.ads',
			'.advertisement',
			'.banner',
			'.share',
			'.social',
			'.comment',
			'.popup',
			'.modal',
			'[role="banner"]',
			'[role="navigation"]',
			'[role="complementary"]',
			'[role="contentinfo"]',
		];
		removeSelectors.forEach((selector) => {
			document.querySelectorAll(selector).forEach((el) => el.remove());
		});
		// Remove all event listeners and inline styles
		function cleanNode(node: Element) {
			node.removeAttribute('style');
			node.removeAttribute('class');
			node.removeAttribute('id');
			const attrs = node.attributes;
			for (let i = attrs.length - 1; i >= 0; i--) {
				const attr = attrs[i];
				if (attr.name.startsWith('on') || attr.name.startsWith('data-')) {
					node.removeAttribute(attr.name);
				}
			}
		}
		document.querySelectorAll('*').forEach(cleanNode);
		// Normalize whitespace and remove empty elements
		function removeEmptyNodes(parent: Element) {
			const children = Array.from(parent.children);
			children.forEach((child) => {
				if (child.children.length > 0) {
					removeEmptyNodes(child);
				}
				if (!child.textContent?.trim() && child.tagName !== 'BR') {
					child.remove();
				}
			});
		}
		removeEmptyNodes(document.body);
		// Add minimal structural markers
		const contentMap: { [key: string]: string } = {
			H1: 'T:', // Title
			H2: 'S:', // Section
			H3: 'SS:', // Subsection
			H4: 'SSS:', // Sub-subsection
			P: 'P:', // Paragraph
			PRE: 'C:', // Code
			CODE: 'C:', // Code
			LI: 'L:', // List item
		};
		function processNode(node: Element) {
			const tag = node.tagName;
			if (contentMap[tag] && node.textContent) {
				node.textContent = `${contentMap[tag]}${node.textContent.trim()}`;
			}
		}
		document.querySelectorAll('*').forEach(processNode);
		// Add minimal URL reference
		const urlDiv = document.createElement('div');
		urlDiv.textContent = `U:${window.location.href}`;
		document.body.insertBefore(urlDiv, document.body.firstChild);
		// Clean up whitespace
		document.body.innerHTML = document.body.innerHTML
			.replace(/\s+/g, ' ')
			.replace(/>\s+</g, '><')
			.trim();
	});
}
async function generateOptimizedPDF(page: Page): Promise<Buffer> {
	const pdfBuffer = await page.pdf({
		format: 'A4',
		printBackground: true,
		margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
		preferCSSPageSize: false,
		omitBackground: true,
		scale: 1,
		displayHeaderFooter: false,
	});
	return Buffer.from(pdfBuffer);
}
export async function generatePDF(
	ctx: BrowserContext,
	url: string,
	urlPattern: RegExp = new RegExp(`^${url}`),
	concurrentLimit: number = cpus().length,
): Promise<Buffer> {
	const limit = pLimit(concurrentLimit);
	const page = await ctx.browser.newPage();
	// Optimize page loading
	await page.setRequestInterception(true);
	page.on('request', (request) => {
		const resourceType = request.resourceType();
		if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
			request.abort();
		} else {
			request.continue();
		}
	});
	await page.goto(url, {
		waitUntil: 'networkidle0',
		timeout: 30000,
	});
	const subLinks = await page.evaluate((patternString) => {
		const pattern = new RegExp(patternString);
		return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
			.map((a) => a.href)
			.filter((href) => pattern.test(href));
	}, urlPattern.source);
	const uniqueSubLinks = Array.from(
		new Set([url, ...subLinks].map(normalizeURL)),
	);
	const pdfDoc = await PDFDocument.create();
	pdfDoc.setTitle('Documentation');
	pdfDoc.setAuthor('site2pdf');
	// Generate minimal TOC
	const tocPage = pdfDoc.addPage([595, 842]); // A4 size in points
	const tocContent = uniqueSubLinks
		.map((link, i) => `${i + 1}. ${link}`)
		.join('\n');
	tocPage.drawText(tocContent, { x: 50, y: 800, size: 8 });
	const generatePDFForPage = async (link: string) => {
		const newPage = await ctx.browser.newPage();
		await newPage.setRequestInterception(true);
		newPage.on('request', (request) => {
			const resourceType = request.resourceType();
			if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
				request.abort();
			} else {
				request.continue();
			}
		});
		await newPage.goto(link, { waitUntil: 'networkidle0', timeout: 30000 });
		await preparePageForAI(newPage);
		const pdfBytes = await generateOptimizedPDF(newPage);
		console.log(`Generated PDF for ${link}`);
		return pdfBytes;
	};
	const pdfPromises = uniqueSubLinks.map((link) =>
		limit(() => generatePDFForPage(link)),
	);
	const pdfBytesArray = await Promise.all(pdfPromises);
	for (const pdfBytes of pdfBytesArray) {
		const subPdfDoc = await PDFDocument.load(pdfBytes);
		const copiedPages = await pdfDoc.copyPages(
			subPdfDoc,
			subPdfDoc.getPageIndices(),
		);
		copiedPages.forEach((page) => pdfDoc.addPage(page));
	}
	// Compress the final PDF
	const pdfBytes = await pdfDoc.save({
		useObjectStreams: true,
		addDefaultPage: false,
		objectsPerTick: 20,
	});
	return Buffer.from(pdfBytes);
}
export function generateSlug(url: string): string {
	return url
		.replace(/https?:\/\//, '')
		.replace(/[^\w\s-]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/\./g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}
export function normalizeURL(url: string): string {
	const urlWithoutAnchor = url.split('#')[0];
	return urlWithoutAnchor.endsWith('/')
		? urlWithoutAnchor.slice(0, -1)
		: urlWithoutAnchor;
}
export async function main() {
	const mainURL = process.argv[2];
	const urlPattern = process.argv[3]
		? new RegExp(process.argv[3])
		: new RegExp(`^${mainURL}`);
	if (!mainURL) {
		showHelp();
		throw new Error('<main_url> is required');
	}
	console.log(
		`Generating AI-optimized PDF for ${mainURL} and sub-links matching ${urlPattern}`,
	);
	let ctx;
	try {
		ctx = await useBrowserContext();
		const pdfBuffer = await generatePDF(ctx, mainURL, urlPattern);
		const slug = generateSlug(mainURL);
		const outputDir = join(process.cwd(), 'out');
		const outputPath = join(outputDir, `${slug}.pdf`);
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
		}
		writeFileSync(outputPath, new Uint8Array(pdfBuffer));
		console.log(`AI-optimized PDF saved to ${outputPath}`);
	} catch (error) {
		console.error('Error generating PDF:', error);
	} finally {
		ctx?.browser.close();
	}
}
if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	main();
}
