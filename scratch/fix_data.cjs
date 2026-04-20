const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/assets/tester_interface.json',
  'device-interfaces/renesas-bms-cabinet-clean.md'
];

filesToFix.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/PWOER/g, 'POWER');
    // Fix the specific indexing error in JSON
    if (file.endsWith('.json')) {
      content = content.replace(/"POWER4-\/电源3-"/g, '"POWER4-/电源4-"');
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed: ${file}`);
  } else {
    console.log(`Not found: ${file}`);
  }
});
