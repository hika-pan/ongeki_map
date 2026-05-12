import { load } from 'cheerio';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const OUT_PATH = resolve(import.meta.dirname, '..', 'stores.json');

const GAME_ID = 88;
const BASE = 'https://location.am-all.net/alm/location';
const USER_AGENT = 'ongeki-map-scraper/1.0 (+https://github.com/hikariri/ongeki-map)';
const THROTTLE_MS = 800;

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県',
  '岐阜県','静岡県','愛知県','三重県',
  '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県',
  '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

async function fetchPrefecture(at) {
  const url = `${BASE}?gm=${GAME_ID}&ct=1000&at=${at}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for at=${at}`);
  return res.text();
}

function normName(s) {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function parsePrefecture(html, at) {
  const $ = load(html);
  const stores = [];

  $('ul.store_list > li').each((_, li)=> {
    const $li = $(li);
    const name = normName($li.find('.store_name').text().trim());
    const address = $li.find('.store_address').text().trim();

    if (!name) return;

    const mapBtn = $li.find('.store_bt_google_map').attr('onclick') || '';
    const latLngMatch = mapBtn.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (!latLngMatch) return;
    const lat = parseFloat(latLngMatch[1]);
    const lng = parseFloat(latLngMatch[2]);

    const detailBtn = $li.find('.bt_details').attr('onclick') || '';
    const sidMatch = detailBtn.match(/sid=(\d+)/);
    const sid = sidMatch ? sidMatch[1] : null;

    stores.push({
      sid,
      name,
      address,
      lat,
      lng,
      pref: PREFECTURES[at],
    });
  });

  return stores;
}

async function main() {
  const all = [];

  for (let at = 0; at < PREFECTURES.length; at++) {
    const prefName = PREFECTURES[at];
    process.stderr.write(`[${at.toString().padStart(2, '0')}] ${prefName} ... `);
    try {
      const html = await fetchPrefecture(at);
      const stores = parsePrefecture(html, at);
      all.push(...stores);
      process.stderr.write(`${stores.length} stores\n`);
    } catch (err) {
      process.stderr.write(`FAILED: ${err.message}\n`);
      throw err;
    }
    if (at < PREFECTURES.length - 1) await setTimeout(THROTTLE_MS);
  }

  const output = {
    generated_at: new Date().toISOString(),
    source: 'https://location.am-all.net/alm/location?gm=88',
    stores: all,
  };

  await writeFile(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  process.stderr.write(`\nWrote ${all.length} stores to ${OUT_PATH}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
