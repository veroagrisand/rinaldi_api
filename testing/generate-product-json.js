import fs from 'fs';

function generateProducts(count = 100, outputFile = 'products.json') {
  const products = [];
  const productFirstNames = [
     'Voucher', 'Gift Card', 'Coupon', 'Subscription', 'Membership', 'License', 'Access Pass', 'Digital Code'
  ];

  const productLastNames = [
    'Amazon', 'Google Play', 'iTunes', 'Steam', 'Xbox', 'PlayStation', 'Netflix', 'Spotify'
  ];

  const productvarietiesNames = [
    '10 USD', '25 USD', '50 USD', '100 USD', '200 USD', '500 USD', '1000 USD'
  ];
  
  for (let i = 1; i <= count; i++) {
    products.push({
      name: `${productFirstNames[Math.floor(Math.random() * productFirstNames.length)]} ${productLastNames[Math.floor(Math.random() * productLastNames.length)]} ${productvarietiesNames[Math.floor(Math.random() * productvarietiesNames.length)]}`,
      description: `Description for Product ${i}`,
      price: parseFloat((Math.random() * 100).toFixed(2)),
      stock: Math.floor(Math.random() * 1000),
    });
  }
  fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));
}

const count = parseInt(process.argv[2], 10) || 100;
const outputFile = process.argv[3] || 'products.json';

generateProducts(count, outputFile);
console.log(`✅ Generated ${count} products into ${outputFile}`); 
