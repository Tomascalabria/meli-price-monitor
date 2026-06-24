import { runScrape } from '@/lib/scraper'

export async function POST() {
  return runScrape()
}
