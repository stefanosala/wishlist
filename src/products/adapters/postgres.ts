import { DbProduct, ProductVectorResult } from "../types";
import { neon } from "@neondatabase/serverless";
import pLimit from "p-limit";
import { z } from "zod";

type ProductVectorResultPostgres = {
  id: string;
  productname: string;
  description: string;
  shopname: string;
  producturl: string;
  imageurl: string;
  pricemin: number;
  pricemax: number;
  currency: string;
  distance: number;
  interests: string[];
}

type DbProductPostgres = {
  id: string;
  productname: string;
  description: string;
  shopname: string;
  producturl: string;
  imageurl: string;
  pricemin: number;
  pricemax: number;
  currency: string;
  active?: boolean;
  interests?: string[];
}

const formatProducts = <T extends DbProduct | ProductVectorResult>(
  products: (DbProductPostgres | ProductVectorResultPostgres)[]
): T[] => {
  return products.map((product) => {
    const formatted = {
      ...product,
      productName: product.productname,
      shopName: product.shopname,
      productUrl: product.producturl,
      imageUrl: product.imageurl,
      priceMin: product.pricemin,
      priceMax: product.pricemax,
    };
    return formatted as unknown as T;
  });
};

const { DATABASE_URL } = z.object({
  DATABASE_URL: z.string(),
}).parse(process.env);

const sql = neon(DATABASE_URL);

export const clearDb = async () => {
  await sql`DROP TABLE IF EXISTS product_vectors`;
  await sql`DROP TABLE IF EXISTS products`;
};

export const setupDb = async () => {
  await sql`CREATE EXTENSION IF NOT EXISTS pg_uuidv7`;
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      productName TEXT,
      description TEXT,
      shopName TEXT,
      productUrl TEXT UNIQUE,
      imageUrl TEXT,
      priceMin FLOAT,
      priceMax FLOAT,
      currency TEXT
      interests TEXT[]
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_vectors (
      productId UUID REFERENCES products(id),
      productEmbedding vector(384)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS interest_vectors (
      interest TEXT UNIQUE,
      interestEmbedding vector(384)
    )
  `;
};

export const clearProductVectors = async () => {
  await sql`
    DELETE FROM product_vectors;
  `;
};

export const findAllProducts = async (
  page: number = 1,
  pageSize: number = 10,
  active?: boolean,
  shopName?: string,
  interests?: string
): Promise<{ products: DbProduct[]; totalCount: number }> => {
  const offset = (page - 1) * pageSize;

  // Split comma-separated interests if provided
  let interestsArray: string[] = [];
  if (interests && interests.trim() !== '') {
    interestsArray = interests.split(',').map(i => i.trim()).filter(i => i !== '');
  }

  // Determine if WHERE clause is needed
  const hasActiveFilter = active !== undefined;
  const hasShopFilter = shopName && shopName.trim() !== '';
  const hasInterestsFilter = interestsArray.length > 0;
  const needsWhere = hasActiveFilter || hasShopFilter || hasInterestsFilter;

  // Construct queries using conditional embedding within the sql tag
  const countResult = await sql`
    SELECT COUNT(*) as count FROM products
    ${needsWhere ? sql`WHERE` : sql``}
    ${hasActiveFilter ? sql`active = ${active}` : sql``}
    ${needsWhere && hasActiveFilter && (hasShopFilter || hasInterestsFilter) ? sql`AND` : sql``}
    ${hasShopFilter ? sql`shopName ILIKE ${'%' + shopName.trim() + '%'}` : sql``}
    ${needsWhere && hasShopFilter && hasInterestsFilter ? sql`AND` : sql``}
    ${hasInterestsFilter ? sql`interests && ${interestsArray}` : sql``}
  `;
  const totalCount = Number(countResult[0].count);

  const products = await sql`
    SELECT * FROM products
    ${needsWhere ? sql`WHERE` : sql``}
    ${hasActiveFilter ? sql`active = ${active}` : sql``}
    ${needsWhere && hasActiveFilter && (hasShopFilter || hasInterestsFilter) ? sql`AND` : sql``}
    ${hasShopFilter ? sql`shopName ILIKE ${'%' + shopName.trim() + '%'}` : sql``}
    ${needsWhere && hasShopFilter && hasInterestsFilter ? sql`AND` : sql``}
    ${hasInterestsFilter ? sql`interests && ${interestsArray}` : sql``}
    ORDER BY id
    LIMIT ${pageSize}
    OFFSET ${offset}
  ` as DbProductPostgres[];

  return {
    products: formatProducts(products),
    totalCount
  };
};

export const findInterestVector = async (interest: string): Promise<number[] | null> => {
  const result = await sql`
    SELECT interestembedding FROM interest_vectors
    WHERE interest = ${interest};
  ` as { interestembedding: string }[];
  return result[0]?.interestembedding ? JSON.parse(result[0]?.interestembedding) : null;
};

export const findProducts = async (embeddings: number[][], priceMin: number = 0, priceMax: number = Number.MAX_SAFE_INTEGER): Promise<ProductVectorResult[]> => {
  const limit = pLimit(10);
  const results = await Promise.all(embeddings.map(embedding => limit(async () => {
    // This query might need adjustment if p.active doesn't exist or for vector syntax
    return await sql`
      SELECT p.*, v.productEmbedding <-> ${`[${embedding.join(",")}]`} AS distance
      FROM product_vectors AS v
      INNER JOIN products AS p ON v.productId = p.id
      WHERE p.active = true
        AND p.priceMin >= ${priceMin}
        AND p.priceMax <= ${priceMax}
      ORDER BY distance
      LIMIT 20
    ` as ProductVectorResultPostgres[];
  })));
  return formatProducts(results.flat());
};

export const findProductsByInterests = async (interests: string[], priceMin: number = 0, priceMax: number = Number.MAX_SAFE_INTEGER): Promise<ProductVectorResult[]> => {
  const loweredCaseInterests = interests.map((interest) => interest.toLowerCase());
  // This query might need adjustment if p.active or p.interests doesn't exist
  const results = await sql`
    SELECT p.*,
           array_length(array(select unnest(p.interests) intersect select unnest(${loweredCaseInterests}::text[])), 1) * -1 as distance
    FROM products AS p
    WHERE p.active = true
      AND p.interests && ${loweredCaseInterests}::text[]
      AND p.priceMin >= ${priceMin}
      AND p.priceMax <= ${priceMax}
    ORDER BY distance ASC,
             array_length(p.interests, 1) ASC
    LIMIT 100
  ` as ProductVectorResultPostgres[];
  return formatProducts(results);
};

export const findProductsByUrl = async (urls: string[]): Promise<DbProduct[]> => {
  const products = await sql`
    SELECT * FROM products
    WHERE productUrl = ANY(${urls});
  ` as DbProductPostgres[];
  return formatProducts(products);
};

export const insertProduct = async (product: DbProduct): Promise<void> => {
  // Reverted to previous version - may need adjustment for active/interests
  await sql`
    INSERT INTO products (
      productName, description, shopName, productUrl, imageUrl, priceMin, priceMax, currency
      ${product.interests ? sql`, interests` : sql``} ${product.active !== undefined ? sql`, active` : sql``}
    ) VALUES (
      ${product.productName}, ${product.description}, ${product.shopName}, ${product.productUrl},
      ${product.imageUrl}, ${product.priceMin}, ${product.priceMax}, ${product.currency}
      ${product.interests ? sql`, ${product.interests}` : sql``}
      ${product.active !== undefined ? sql`, ${product.active}` : sql``}
    ) ON CONFLICT (productUrl) DO NOTHING;`; // Example dynamic insertion
};

export const insertProductVector = async (productId: string | number, productEmbedding: number[]): Promise<void> => {
  // Reverted - Vector syntax might need review
  await sql`
    INSERT INTO product_vectors (productId, productEmbedding)
    VALUES (${productId}, ${`[${productEmbedding.join(",")}]`});
  `;
};

export const updateProduct = async (product: Omit<DbProduct, 'id'>): Promise<void> => {
  // Reverted - Needs careful dynamic construction if active/interests are added
  await sql`
    UPDATE products
    SET productName = ${product.productName},
        description = ${product.description},
        shopName = ${product.shopName},
        productUrl = ${product.productUrl},
        imageUrl = ${product.imageUrl},
        priceMin = ${product.priceMin},
        priceMax = ${product.priceMax},
        currency = ${product.currency}
        ${product.interests !== undefined ? sql`, interests = ${product.interests}` : sql``}
        ${product.active !== undefined ? sql`, active = ${product.active}` : sql``}
    WHERE productUrl = ${product.productUrl};
  `;
};

export const upsertInterestVector = async (interest: string, interestEmbedding: number[]): Promise<void> => {
  // Reverted - Vector syntax might need review
  await sql`
    INSERT INTO interest_vectors (interest, interestEmbedding)
    VALUES (${interest}, ${`[${interestEmbedding.join(",")}]`})
    ON CONFLICT (interest) DO UPDATE SET interestEmbedding = EXCLUDED.interestEmbedding;
  `;
};

const postgresAdapter = {
  clearDb,
  clearProductVectors,
  setupDb,
  findAllProducts,
  findInterestVector,
  findProducts,
  findProductsByInterests,
  findProductsByUrl,
  insertProduct,
  insertProductVector,
  updateProduct,
  upsertInterestVector,
};

export default postgresAdapter;
