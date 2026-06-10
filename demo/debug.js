const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5177');

  // Wait for React to render
  await new Promise(r => setTimeout(r, 2000));

  console.log('--- Initial State ---');
  await printBackdropFilters(page);

  // Simulate dragging the Blur slider to 60
  // The blur slider is the first input[type="range"]
  console.log('--- Dragging Blur Slider to 60 ---');
  await page.evaluate(() => {
    const slider = document.querySelector('input[type="range"]');
    if (slider) {
      // Create a native event to simulate a real user input
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(slider, '60');
      
      const event = new Event('change', { bubbles: true });
      slider.dispatchEvent(event);
      
      const inputEvent = new Event('input', { bubbles: true });
      slider.dispatchEvent(inputEvent);
    }
  });

  // Wait for React to re-render
  await new Promise(r => setTimeout(r, 1000));

  console.log('--- Final State ---');
  await printBackdropFilters(page);

  await browser.close();
})();

async function printBackdropFilters(page) {
  const filters = await page.evaluate(() => {
    // Find all preset panels and Live Preview
    const panels = Array.from(document.querySelectorAll('.glass-panel'));
    const livePreview = document.querySelector('.live-preview-box');
    
    const results = [];
    
    // Check panels
    panels.forEach(p => {
      const h2 = p.querySelector('h2');
      const title = h2 ? h2.textContent : 'Unknown Panel';
      const lens = p.querySelector('.ql-lens');
      const bdf = lens ? window.getComputedStyle(lens).backdropFilter : 'No .ql-lens';
      results.push(`${title}: ${bdf}`);
    });
    
    // Check Live Preview
    if (livePreview) {
      const lens = livePreview.querySelector('.ql-lens');
      const bdf = lens ? window.getComputedStyle(lens).backdropFilter : 'No .ql-lens';
      results.push(`Live Preview: ${bdf}`);
    }

    return results;
  });
  
  filters.forEach(f => console.log(f));
}
