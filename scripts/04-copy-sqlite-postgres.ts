import sqliteAdapter from '../src/products/adapters/sqlite';
import postgresAdapter from '../src/products/adapters/postgres';
import pLimit from 'p-limit';
import { DbProduct } from '@/products/types';

await postgresAdapter.clearDb();
await postgresAdapter.setupDb();

const { products: sqliteProducts } = await sqliteAdapter.findAllProducts(1, Number.MAX_SAFE_INTEGER);

const limit = pLimit(10);

await Promise.all(sqliteProducts.map((product: DbProduct) =>
  limit(async () => {
    console.log(`Copying product ${product.id} to postgres`);
    await postgresAdapter.insertProduct(product);
  })
));
