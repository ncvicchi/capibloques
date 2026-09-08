import type { Page } from '@playwright/test';

// Geometry only, on synthetic UI fixtures. Include the offending element in CI
// assertion messages instead of accepting a wider viewport or hiding overflow.
export async function viewportBounds(page: Page) {
  return page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    viewport: innerWidth,
    overflowing: Array.from(document.querySelectorAll('body *')).flatMap(element => {
      const box = element.getBoundingClientRect();
      if (box.width && box.right > innerWidth + 1 && element instanceof HTMLElement) {
        const style = getComputedStyle(element);
        return [{ tag: element.tagName, class: element.className, right: box.right, width: box.width, font: style.fontFamily, fontSize: style.fontSize }];
      }
      return [];
    }).slice(0, 30),
  }));
}
