import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\USER\\Desktop\\macmidia\\src\\features\\offer-generator\\components\\StepReview.tsx', 'utf8');
const lines = content.split('\n');

let braces = 0;
let parens = 0;

for (let i = 560; i < 610; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '(') parens++;
        if (char === ')') parens--;
    }
    console.log(`Line ${lineNum}: braces=${braces}, parens=${parens} | Content: ${line.trim()}`);
}
