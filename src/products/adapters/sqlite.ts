import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { DbProduct, ProductVectorResult } from '../types';
import fs from 'fs';

let db: Database.Database;
let PRODUCT_VECTORS_QUERY: Database.Statement;

if (fs.existsSync(`${process.cwd()}/db/products.db`)) {
  db = new Database(`${process.cwd()}/db/products.db`);
  sqliteVec.load(db);

  PRODUCT_VECTORS_QUERY = db.prepare(`
    SELECT product_vectors.distance, products.*
    FROM product_vectors
    INNER JOIN products ON product_vectors.productId = products.id
    WHERE product_vectors.productEmbedding MATCH :embeddings AND k = 50
      AND products.priceMin >= :priceMin AND products.priceMax <= :priceMax
    ORDER BY product_vectors.distance
  `);
}

export const clearDb = async () => {
  db.exec(`
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS product_vectors;
  `);
};

export const clearProductVectors = async () => {
  db.exec(`
    DELETE FROM product_vectors;
  `);
};

export const setupDb = async () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productName TEXT,
      description TEXT,
      shopName TEXT,
      productUrl TEXT UNIQUE,
      imageUrl TEXT,
      priceMin FLOAT,
      priceMax FLOAT,
      currency TEXT
    )
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS product_vectors USING vec0(
      productId FLOAT,
      productEmbedding FLOAT[384]
    );
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS interest_vectors USING vec0(
      interest TEXT UNIQUE,
      interestEmbedding FLOAT[384]
    );
  `);
};

export const findAllProducts = async (
  page: number = 1,
  pageSize: number = 10,
  active?: boolean,
  shopName?: string,
  interests?: string
): Promise<{ products: DbProduct[]; totalCount: number }> => {
  const offset = (page - 1) * pageSize;

  // Build WHERE clause and parameters dynamically
  let whereClause = 'WHERE 1=1'; // Start with a true condition
  const params: (string | number | boolean)[] = [];

  // NOTE: Assuming an 'active' column exists in SQLite schema for this filter
  if (active !== undefined) {
    whereClause += ' AND active = ?';
    params.push(active ? 1 : 0); // SQLite uses 0/1 for boolean
  }
  if (shopName && shopName.trim() !== '') {
    whereClause += ' AND shopName LIKE ?'; // LIKE is case-insensitive by default in SQLite, unless PRAGMA case_sensitive_like=ON
    params.push('%' + shopName.trim() + '%');
  }
  if (interests && interests.trim() !== '') {
    // Split comma-separated interests
    const interestsArray = interests.split(',').map(i => i.trim()).filter(i => i !== '');

    if (interestsArray.length > 0) {
      // Build a clause that checks if any of the interests match
      const interestClauses = interestsArray.map(() => 'EXISTS (SELECT 1 FROM JSON_EACH(interests) WHERE value LIKE ?)');
      whereClause += ` AND (${interestClauses.join(' OR ')})`;

      // Add parameters for each interest
      interestsArray.forEach(interest => {
        params.push('%' + interest + '%');
      });
    }
  }

  // Query for the total count with filters
  const countSql = `SELECT COUNT(*) as count FROM products ${whereClause}`;
  const countResult = db.prepare(countSql).get(params) as { count: number };
  const totalCount = countResult.count;

  // Query for the paginated products with filters
  const productsSql = `SELECT * FROM products ${whereClause} ORDER BY id LIMIT ? OFFSET ?`;
  const products = db.prepare(productsSql).all([...params, pageSize, offset]) as DbProduct[];

  return {
    products,
    totalCount
  };
};

export const findInterestVector = async (interest: string): Promise<number[] | null> => {
  const result = db.prepare('SELECT interestEmbedding FROM interest_vectors WHERE interest = ?').get(interest) as { interestEmbedding: number[] } | undefined;
  return result?.interestEmbedding ?? null;
};

export const findProducts = async (embeddings: number[][], priceMin: number = 0, priceMax: number = Number.MAX_SAFE_INTEGER): Promise<ProductVectorResult[]> => {
  let results: ProductVectorResult[] = [];

  for (const batch of embeddings) {
    results = results.concat(PRODUCT_VECTORS_QUERY.all({ embeddings: batch, priceMin, priceMax }) as ProductVectorResult[]);
  }

  return results;
};

export const findProductsByInterests = async (interests: string[], priceMin: number = 0, priceMax: number = Number.MAX_SAFE_INTEGER): Promise<ProductVectorResult[]> => {
  console.log(`Finding products by interests: ${interests.join(", ")}`, { priceMin, priceMax });
  throw new Error('Not implemented');
};

export const findProductsByUrl = async (urls: string[]): Promise<DbProduct[]> => {
  return db.prepare('SELECT * FROM products WHERE productUrl IN (?)').all(urls) as DbProduct[];
};

export const insertProduct = async (product: DbProduct): Promise<void> => {
  db.prepare(`
    INSERT INTO products (productName, description, shopName, productUrl, imageUrl, priceMin, priceMax, currency)
    VALUES (:productName, :description, :shopName, :productUrl, :imageUrl, :priceMin, :priceMax, :currency)
  `).run(product);
};

export const insertProductVector = async (productId: string | number, productEmbedding: number[]): Promise<void> => {
  db.prepare(`
    INSERT INTO product_vectors (productId, productEmbedding)
    VALUES (:productId, :productEmbedding)
  `).run({ productId, productEmbedding });
};

export const updateProduct = async (product: Omit<DbProduct, 'id'>): Promise<void> => {
  db.prepare(`
    UPDATE products
    SET productName = :productName,
        description = :description,
        shopName = :shopName,
        imageUrl = :imageUrl,
        priceMin = :priceMin,
        priceMax = :priceMax,
        currency = :currency
    WHERE productUrl = :productUrl
  `).run(product);
};

export const upsertInterestVector = async (interest: string, interestEmbedding: number[]): Promise<void> => {
  db.prepare(`
    INSERT OR REPLACE INTO interest_vectors (interest, interestEmbedding)
    VALUES (:interest, :interestEmbedding)
  `).run({ interest, interestEmbedding });
};

const sqliteAdapter = {
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

export default sqliteAdapter;
