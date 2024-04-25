import { CheerioCrawler, Configuration } from 'crawlee';

import { generateEmbeddings } from './lib/generate-embeddings.js';
import { prisma } from './lib/db.js';

export type DocMetadata = {
  title: string;
  url: string | undefined;
  text: string;
};

export async function runCrawler(
  websiteUrl: string,
  match: string,
  cssSelector: string,
  maxPagesToCrawl: number,
  pineconeApiKey: string,
  pineconeIndexName: string,
  projectId: string
) {
  let data: DocMetadata[] = [];
  const saveData = ({ title, url, text }: DocMetadata) => {
    // TODO: optimise to check if doc with title already exist in data
    let isExist = false;
    data.forEach((d) => {
      if (d.url === url) {
        isExist = true;
        return;
      }
    });
    if (!isExist) data.push({ title, url, text });
  };

  const crawler = new CheerioCrawler(
    {
      requestHandler: async ({ request, enqueueLinks, log, $ }) => {
        await enqueueLinks({
          globs: typeof match === 'string' ? [match] : match, // Queue all link with this pattern to crawl
        });

        // const title = await page.title()
        const title = $('title').text();

        await prisma.logMessage.create({
          data: {
            message: `▻ Crawling [${title}] → ${request.loadedUrl}`,
            projectId,
          },
        });

        log.info(`✅ ${title}`, { url: request.loadedUrl });

        let docTextContent: string | null;

        if (cssSelector) {
          // await page.waitForSelector(cssSelector)
          // docTextContent = await page.$eval(cssSelector, (el) => el.textContent)
          docTextContent = $(cssSelector).text();
        } else {
          docTextContent = $('body').text();
          // docTextContent = await page.textContent('body') // If selector is not provided, extract all text from the page.
        }

        // Remove extra \n and spacess to save storage and tokens
        const cleanText = docTextContent
          ?.replace(/\n/g, ' ')
          .replace(/\s+/g, ' ');

        // save data for further creating and storing embeddings
        saveData({ title, url: request.loadedUrl, text: cleanText });
      },
      // headless: true,
      maxRequestsPerCrawl: maxPagesToCrawl,
      maxConcurrency: 2,
      maxRequestRetries: 2,
    },
    new Configuration({
      persistStorage: false,
    })
  );

  try {
    await crawler.run([websiteUrl]);

    await prisma.logMessage.create({
      data: {
        message: `✅ Pages scraped → ${crawler.stats.state.requestsFinished}, Pages failed → ${crawler.stats.state.requestsFailed}`,
        projectId,
      },
    });
    await crawler.requestQueue?.drop();

    await prisma.logMessage.create({
      data: {
        message: `➤ Processing data into vector store...`,
        projectId,
      },
    });
    await generateEmbeddings(data, {
      pineconeApiKey,
      pineconeIndexName,
      projectId,
    });
    return { success: true, message: 'crawl completed' };
  } catch (error: any) {
    throw new Error(error.message);
    // return { success: false, error: 'Crawl: '+error.message }
  }
}
