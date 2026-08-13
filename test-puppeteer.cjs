const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });

  // Navigate to login first
  await page.goto('http://localhost:5173/login');
  
  // Try to login (we need a valid user, or we can just bypass if we know the token)
  // Let's type credentials
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'rafael.lbg@hotmail.com'); // Example admin
  await page.type('input[type="password"]', '123456'); // Example pw (or just let it fail and see)
  
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  
  // Navigate to a contract
  // Let's get a contract ID first
  console.log('Navigating to contract...');
  await page.goto('http://localhost:5173/contratos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const href = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/contratos/"]');
    return a ? a.href : null;
  });

  if (href) {
    console.log('Found contract href:', href);
    await page.goto(href, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));
  } else {
    console.log('No contract link found on list');
  }

  await browser.close();
})();
