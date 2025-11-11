import { NextResponse } from 'next/server'
import { products } from '@/lib/data/products'

export async function GET() {
  return NextResponse.json(products)
}