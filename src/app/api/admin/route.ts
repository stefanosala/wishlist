import { NextRequest, NextResponse } from 'next/server';
import { findAllProducts } from '@/products/db'; // Assuming @ maps to src/

export const dynamic = 'force-dynamic'; // Ensure the route is dynamically rendered

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const shopName = searchParams.get('shopName') || undefined; // Get shopName, default to undefined
  const activeParam = searchParams.get('active'); // Get active status param
  const interests = searchParams.get('interests') || undefined; // Get interests filter

  let activeFilter: boolean | undefined = undefined;
  if (activeParam === 'true') {
    activeFilter = true;
  } else if (activeParam === 'false') {
    activeFilter = false;
  }
  // If activeParam is null or something else, activeFilter remains undefined (no filter applied)

  if (isNaN(page) || page < 1) {
    return NextResponse.json({ message: 'Invalid page number' }, { status: 400 });
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) { // Add a max page size limit
    return NextResponse.json({ message: 'Invalid page size (must be 1-100)' }, { status: 400 });
  }

  try {
    // Pass filters to findAllProducts
    const { products, totalCount } = await findAllProducts(page, pageSize, activeFilter, shopName, interests);
    return NextResponse.json({ products, totalCount });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
