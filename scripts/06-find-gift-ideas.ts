import { setupDb, findGiftIdeaByUrl, insertGiftIdea, updateGiftIdeaInterests } from '@/products/adapters/postgres';
import { ProductSchema } from '@/products/types';
import pLimit from 'p-limit';
import { getJson } from 'serpapi';

const serpapiKey = process.env.SERPAPI_KEY;

if (!serpapiKey) {
  throw new Error('SERPAPI_KEY is not set');
}

await setupDb();

const CURATED_INTERESTS = [
  '3D Printing',
  'Acting',
  'Adventure Travel',
  'AI',
  'Alternative Music',
  'American Football',
  'Anime',
  'Archery',
  'Art',
  'Astronomy',
  'Audio Production',
  'Aviation',
  'Baking',
  'Baseball',
  'Basketball',
  'BBQ',
  'Beauty',
  'Biking',
  'Birdwatching',
  'Blogging',
  'Board Games',
  'Boating',
  'Bodybuilding',
  'Books',
  'Camping',
  'Canoeing and Kayaking',
  'Car Racing',
  'Cars',
  'Chess',
  'Cinema',
  'Climbing',
  'Coffee',
  'Comic Books',
  'Cooking',
  'Cosplay',
  'Crafting',
  'CrossFit',
  'Cycling',
  'Dance and Electronic Music',
  'Dancing',
  'Desserts and Baking',
  'Digital Art',
  'DIY Projects',
  'Dogs',
  'Drawing',
  'Drums',
  'Dungeons and Dragons',
  'Fishing',
  'Fitness',
  'Gardening',
  'Gaming',
  'Guitar',
  'Hiking',
  'Home Improvement',
  'Jewelry Making',
  'Kayaking',
  'Knitting',
  'Lego',
  'Magic and Illusion',
  'Martial Arts',
  'Meditation',
  'Mental Health',
  'Mindfulness',
  'Movies',
  'Mountain Biking',
  'Music',
  'Music Production',
  'Nature Photography',
  'Painting',
  'Photography',
  'Piano',
  'Podcasts',
  'Pottery',
  'Reading',
  'Rock Climbing',
  'Rock Music',
  'Running',
  'Sailing',
  'Sci-fi and Fantasy',
  'Sewing',
  'Skateboarding',
  'Skiing',
  'Snowboarding',
  'Soccer',
  'Sports',
  'Surfing',
  'Swimming',
  'Video Games',
  'Weightlifting',
  'Yoga',
];

const search = async (interest: string) => {
  const result = await getJson({
    api_key: serpapiKey,
    engine: 'google_shopping',
    q: `Gift ideas for a person who love ${interest}`,
    google_domain: 'google.com',
    hl: 'en',
    gl: 'us',
    num: '40',
  });

  /**
   *
   * {
        "position": 1,
        "title": "Sally's Baking Addiction: Irresistible Cookies, Cupcakes, and Desserts for Your Sweet-Tooth Fix",
        "product_link": "https://www.google.com/shopping/product/17602805523464211149?gl=us",
        "product_id": "17602805523464211149",
        "serpapi_product_api": "https://serpapi.com/search.json?engine=google_product&gl=us&google_domain=google.com&hl=en&product_id=17602805523464211149",
        "immersive_product_page_token": "eyJlaSI6IldPQWRhT2phTEtlcnB0UVB2OFdVd0FnIiwicHJvZHVjdGlkIjoiIiwiY2F0YWxvZ2lkIjoiMTc2MDI4MDU1MjM0NjQyMTExNDkiLCJoZWFkbGluZU9mZmVyRG9jaWQiOiIzMTgzNjI3NjI1MzE1NDE3OTg4IiwiaW1hZ2VEb2NpZCI6IjIzMjEzNzU2MjU5MTU0NzI3IiwicmRzIjoiUENfMTU2NTI1MDkyNTUxMzU1ODY3Mzd8UFJPRF9QQ18xNTY1MjUwOTI1NTEzNTU4NjczNyIsInF1ZXJ5IjoiYmFraW5nIiwiZ3BjaWQiOiIxNTY1MjUwOTI1NTEzNTU4NjczNyIsIm1pZCI6IjU3NjQ2MjIwMTQxNDUzNzQ5OCIsInB2dCI6ImhnIiwidXVsZSI6bnVsbH0=",
        "serpapi_immersive_product_api": "https://serpapi.com/search.json?engine=google_immersive_product&page_token=eyJlaSI6IldPQWRhT2phTEtlcnB0UVB2OFdVd0FnIiwicHJvZHVjdGlkIjoiIiwiY2F0YWxvZ2lkIjoiMTc2MDI4MDU1MjM0NjQyMTExNDkiLCJoZWFkbGluZU9mZmVyRG9jaWQiOiIzMTgzNjI3NjI1MzE1NDE3OTg4IiwiaW1hZ2VEb2NpZCI6IjIzMjEzNzU2MjU5MTU0NzI3IiwicmRzIjoiUENfMTU2NTI1MDkyNTUxMzU1ODY3Mzd8UFJPRF9QQ18xNTY1MjUwOTI1NTEzNTU4NjczNyIsInF1ZXJ5IjoiYmFraW5nIiwiZ3BjaWQiOiIxNTY1MjUwOTI1NTEzNTU4NjczNyIsIm1pZCI6IjU3NjQ2MjIwMTQxNDUzNzQ5OCIsInB2dCI6ImhnIiwidXVsZSI6bnVsbH0%3D",
        "source": "Amazon.com - Seller",
        "source_icon": "https://serpapi.com/searches/681de057d1a72bf0fc0e8fa0/images/e76cb772cf76a054e6c7f0bd8ea143311710e3908bc09e65ad8893431389b7de.png",
        "multiple_sources": true,
        "price": "$72.99",
        "extracted_price": 72.99,
        "rating": 4.8,
        "reviews": 19,
        "snippet": "Non-fiction",
        "thumbnail": "https://serpapi.com/searches/681de057d1a72bf0fc0e8fa0/images/e76cb772cf76a054e6c7f0bd8ea143311a359346edc0a3ba0efa610074aa2bc1.webp",
        "thumbnails":
        [
            "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTDFOv_90PxnggohwR-kMbl5YMgocyXSxodg770tf2M1pwYVHoPvQV4s4QlOH8BmLjOXdO5eGQJHqY4nK_0WBcfNIlEDIP_Nan1mrt_4Zo"
        ]
        ,
        "serpapi_thumbnails":
        [
            "https://serpapi.com/images/url/Q-xfOXicDcnbEkJAAADQL3IrRsw0TUahcqtG9GJYLMXusjsun9Nn9Td1Xs_3UzNGqC4IJQLDQlhZcCxHax5SlrEG8AB3Aq0xIQ2Cu377P33vFZoF7ubRH1NNDGYEIa6nK_d281ZJXIjBEt9mXEBVFVm1ciUyJZGNgzGMZCqHrW9vjO7y8uPCV0orPNl9IqNzKj4MUHlOezCdIPUyJHUDS-Un_gEwQTm7"
        ]
      }
   */

  const limit = pLimit(1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await Promise.all(result.shopping_results.map((productData: any) => limit(async () => {
    console.log(`Working on ${productData.title}`);

    try {
      const product = ProductSchema.parse({
        productName: productData.title,
        description: productData.snippet ?? '',
        shopName: productData.source,
        productUrl: productData.product_link,
        imageUrl: productData.thumbnails[0] ?? productData.thumbnail,
        priceMin: productData.extracted_price,
        priceMax: productData.extracted_price,
        currency: 'USD',
        interests: [interest],
        active: true,
      });

      const giftIdea = await findGiftIdeaByUrl(product.productUrl);

      if (giftIdea) {
        const mergedInterests = new Set([...(giftIdea.interests ?? []), ...(product.interests ?? [])]);
        await updateGiftIdeaInterests(giftIdea.productUrl, Array.from(mergedInterests));
      } else {
        console.log(`Inserting gift idea: ${product.productUrl}`);
        await insertGiftIdea(product);
      }

      console.log(`Processed ${productData.title}`);
    } catch (e) {
      console.error(`Error processing ${productData.title}: ${e}`);
    }
  })));
};

const limit = pLimit(1);

await Promise.all(CURATED_INTERESTS.map(interest => limit(async () => {
  console.log(`Searching for gift ideas for ${interest}`);
  await search(interest);
})));
