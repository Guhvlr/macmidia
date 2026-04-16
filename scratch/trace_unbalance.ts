import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\USER\\Desktop\\macmidia\\src\\features\\offer-generator\\components\\StepReview.tsx', 'utf8');
const lines = content.split('\n');

let braces = 0;
let parens = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '(') parens++;
        if (char === ')') parens--;
    }
    if (parens !== 0 || braces !== 0) {
        console.log(`Line ${i + 1}: braces=${braces}, parens=${parens}`);
    }
}
