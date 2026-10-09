import fs from 'fs';

const css = fs.readFileSync('style.css', 'utf8');

function extractVars(block) {
  const vars = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    vars['--' + m[1]] = m[2].trim();
  }
  return vars;
}

const rootIdx = css.indexOf(':root');
const darkIdx = css.indexOf('[data-theme="dark"]');
const starIdx = css.indexOf('* {');

const rootBlock = css.slice(rootIdx, darkIdx);
const darkBlock = css.slice(darkIdx, starIdx);

const rootVars = extractVars(rootBlock);
const darkVars = extractVars(darkBlock);

console.log('=== ROOT (LIGHT) VARS ===');
console.log(JSON.stringify(rootVars, null, 2));

console.log('=== DARK VARS ===');
console.log(JSON.stringify(darkVars, null, 2));
