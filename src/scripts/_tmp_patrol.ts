import { sendCard } from '../notify/card.js';
import * as fs from 'fs';

async function main() {
  const card = JSON.parse(fs.readFileSync('/tmp/hermes_patrol_card.json', 'utf8'));
  const id = await sendCard(card);
  console.log(id || 'FAILED');
}
main();
