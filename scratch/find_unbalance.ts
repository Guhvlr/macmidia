import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\USER\\Desktop\\macmidia\\src\\features\\offer-generator\\components\\StepReview.tsx', 'utf8');

let braces = 0;
let parens = 0;

for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') braces++;
    if (content[i] === '}') braces--;
    if (content[i] === '(') parens++;
    if (content[i] === ')') parens--;
    
    if (parens < 0) console.log(`Extra ) at char ${i}`);
    if (braces < 0) console.log(`Extra } at char ${i}`);
}

console.log(`Final: braces=${braces}, parens=${parens}`);
