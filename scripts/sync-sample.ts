import { syncCatalogFromFile } from "../src/services/catalog.js";

async function main() {
  const count = await syncCatalogFromFile("./example-library-xml/library_zim.xml");
  console.log(`Synced ${count} books from sample catalog`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
