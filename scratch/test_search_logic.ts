
import { normalize, wordOverlap, assessConfidence } from './mock_logic.ts';

// Test Cases
const tests = [
  {
    input: { brand_hint: 'SAFRA', type_hint: 'ARROZ', display_name: 'ARROZ SAFRA 5KG', original: 'ARROZ SAFRA 5KG' },
    db: { name: 'ARROZ SAFRA 5KG', brand: null },
    expected: 'high'
  },
  {
    input: { brand_hint: 'ITALAC', type_hint: 'LEITE', display_name: 'LEITE ITALAC 1L', original: 'LEITE ITALAC 1L' },
    db: { name: 'LEITE UHT INTEGRAL ITALAC 1L', brand: 'ITALAC' },
    expected: 'high'
  },
  {
    input: { brand_hint: 'NESTLE', type_hint: 'CEREAL', display_name: 'NESCAU CEREAL', original: 'NESCAU CEREAL' },
    db: { name: 'CEREAL MATINAL NESCAU 210G', brand: 'NESTLE' },
    expected: 'high'
  }
];

tests.forEach((t, i) => {
  const conf = assessConfidence(
    t.input.brand_hint,
    t.input.type_hint,
    t.input.display_name,
    t.db.name,
    t.db.brand || ''
  );
  console.log(`Test ${i + 1}: ${t.input.display_name} vs ${t.db.name}`);
  console.log(`Confidence: ${conf.level} (${conf.reason})`);
  console.log('---');
});
