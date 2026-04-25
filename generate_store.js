const fs = require('fs');
const content = fs.readFileSync('src/features/offer-generator/context/OfferContext.tsx', 'utf8');

// I will write a simple generator that extracts state, types, and logic, but it's too complex to parse React hooks robustly with Regex.

