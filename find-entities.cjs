const fs = require('fs');
const path = require('path');

function findEntities(dir, entities = new Set()) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findEntities(fullPath, entities);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(/base44\.entities\.([A-Za-z0-9_]+)/g);
      if (matches) {
        for (const m of matches) {
          entities.add(m.replace('base44.entities.', ''));
        }
      }
    }
  }
  return entities;
}

const entities = findEntities(path.join(__dirname, 'src'));
console.log("Entities used in code:", Array.from(entities).sort());
