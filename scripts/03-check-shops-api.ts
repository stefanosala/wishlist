import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import axios from "axios";
import { Shop } from "@/products/types";
import pLimit from "p-limit";

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const readShops = async (filename: string) => {
  const content = await readFileSync(filename, 'utf-8')
    .split('\n')
    .map((line) => {
      const parts = line.split(',');

      const name = parts[0];
      let url = parts[1];

      if (!url?.startsWith('http')) url = `https://${url}`;

      return { name, url };
    });

  return content.map((shop) => {
    try {
      return z.object({
        name: z.string(),
        url: z.string().url(),
      }).parse(shop);
    } catch {
      return null;
    }
  }).filter((shop) => shop !== null);
};

const checkShopApi = async (shop: Shop) => {
  console.log(`Checking ${shop.name}...`);

  const apiUrl = new URL('/wp-json/wp/v2/product', shop.url).toString();

  try {
    const response = await axios.get(apiUrl, { headers: HEADERS, timeout: 10000 });

    console.log(`${shop.name} - ${response.status}`);

    return {
      shop: shop.name,
      url: shop.url,
      status: response.status,
      isJson: response.headers['content-type']?.includes('application/json') ?? false,
      hasProducts: Array.isArray(response.data),
      error: null,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.log(`${shop.name} - ${error.response?.status} ${apiUrl.toString()}`);

      return {
        shop: shop.name,
        url: shop.url,
        status: error.response?.status ?? 0,
        isJson: false,
        hasProducts: false,
        error: error.message,
      };
    }

    return {
      shop: shop.name,
      url: shop.url,
      status: 0,
      isJson: false,
      hasProducts: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

const argv = await yargs(hideBin(process.argv))
  .option('input', {
    type: 'string',
    default: 'shops-to-check.csv',
    description: 'Input CSV file containing shop URLs (shop_name, url)'
  })
  .option('output', {
    type: 'string',
    default: 'shops-api-check-results.csv',
    description: 'Output CSV file for results'
  })
  .help()
  .alias('help', 'h')
  .argv;

const shops = await readShops(argv.input);
console.log(`Found ${shops.length} shops to check`);

const limit = pLimit(20);

const results = await Promise.all(shops.map((shop) => limit(() => checkShopApi(shop))));

// Write results to CSV
const csvContent = [
  ['Shop', 'URL', 'Products URL', 'Status', 'Is JSON', 'Has Products', 'Error'].join(','),
  ...results.map(result => [
    result.shop,
    result.url,
    `${result.url}wp-json/wp/v2/product`,
    result.status,
    result.isJson,
    result.hasProducts,
    result.error ? `"${result.error}"` : ''
  ].join(','))
].join('\n');

writeFileSync(argv.output, csvContent);
console.log(`Results written to ${argv.output}`);
