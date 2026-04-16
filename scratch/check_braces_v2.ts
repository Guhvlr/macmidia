import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\USER\\Desktop\\macmidia\\src\\features\\offer-generator\\components\\StepReview.tsx', 'utf8');
const lines = content.split('\n');

let braces = 0;
let parens = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') braces++;
        if (line[j] === '}') braces--;
        if (line[j] === '(') parens++;
        if (line[j] === ')') parens--;
    }
    if (braces !== 0 || parens !== 0) {
        // console.log(`Line ${i + 1}: braces=${braces}, parens=${parens}`);
    }
}
console.log(`Final: braces=${braces}, parens=${parens}`);
