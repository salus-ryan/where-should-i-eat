import { chromium, Browser, Page } from 'playwright';
import { PlatformReview, ScrapingResult } from '@/types';

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  abstract platform: PlatformReview['platform'];
  abstract searchUrl(query: string, location: string): string;
  abstract parseResults(page: Page): Promise<PlatformReview | null>;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
    });
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    this.page = await context.newPage();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async scrape(query: string, location: string): Promise<ScrapingResult> {
    try {
      if (!this.page) {
        await this.init();
      }

      const url = this.searchUrl(query, location);
      await this.page!.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait a bit for dynamic content
      await this.page!.waitForTimeout(2000);

      const data = await this.parseResults(this.page!);

      if (!data) {
        return {
          success: false,
          error: `No results found on ${this.platform}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
