const { base44 } = require('./src/api/base44Client.js');

async function testTags() {
  try {
    const res = await base44.entities.ClientTag.create({
      nome: "VIP",
      cor: "#ff0000"
    });
    console.log("ClientTag created successfully:", res);
    const tags = await base44.entities.ClientTag.list();
    console.log("Tags listed:", tags.length);
  } catch (err) {
    console.error("Error with ClientTags:", err);
  }
}

testTags();
