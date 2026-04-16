import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\USER\\Desktop\\macmidia\\src\\features\\offer-generator\\components\\StepReview.tsx', 'utf8');
const lines = content.split('\n');

let braces = 0;
let parens = 0;

for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    
    // Print BEFORE processing
    if (lineNum === 597 || lineNum === 598 || lineNum === 671 || lineNum === 672 || lineNum === 788) {
        console.log(`B4 Line ${lineNum}: braces=${braces}, parens=${parens} | Content: ${line.trim()}`);
    }

    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') braces++;
        if (line[j] === '}') braces--;
        if (line[j] === '(') parens++;
        if (line[j] === ')') parens--;
    }

    // Print AFTER processing
    if (lineNum === 597 || lineNum === 598 || lineNum === 671 || lineNum === 672 || lineNum === 788) {
        console.log(`AF Line ${lineNum}: braces=${braces}, parens=${parens}`);
    }
}
console.log(`Final: braces=${braces}, parens=${parens}`);
