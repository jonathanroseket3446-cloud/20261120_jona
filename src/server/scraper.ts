
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

let DEFAULT_THERASABDAB: any = null;
try {
    const defaultData = fs.readFileSync(path.join(process.cwd(), 'src/server/default_therasabdab.json'), 'utf-8');
    DEFAULT_THERASABDAB = JSON.parse(defaultData);
} catch (e) {
    console.warn("Failed to load default therasabdab data", e);
}


const CACHE_FILE = path.join(process.cwd(), 'guidelines_cache.json');

let DEFAULT_TAP: any = null;
let DEFAULT_TNP: any = null;

try {
    const opigData = fs.readFileSync(path.join(process.cwd(), 'src/server/default_opig.json'), 'utf-8');
    const parsed = JSON.parse(opigData);
    DEFAULT_TAP = parsed.tap;
    DEFAULT_TNP = parsed.tnp;
} catch (e) {
    console.warn("Failed to load default opig data", e);
    // Fallbacks just in case
    DEFAULT_TAP = {};
    DEFAULT_TNP = {};
}


import { computeGuidelines } from './stats';

export function saveGuidelines(data: any) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

export function getGuidelines() {
  const ensureCombinedVHVL = (thera: any) => {
    if (thera && thera.VHVL && !thera.VHVL.VHVL) {
      try {
        const computed = computeGuidelines({});
        if (computed?.therasabdab?.VHVL?.VHVL) {
          thera.VHVL.VHVL = computed.therasabdab.VHVL.VHVL;
        }
      } catch (e) {}
    }
    return thera;
  };

  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      if (!data.therasabdab && DEFAULT_THERASABDAB) {
        data.therasabdab = DEFAULT_THERASABDAB;
      }
      data.therasabdab = ensureCombinedVHVL(data.therasabdab);
      return data;
    } catch (err) {}
  }
  return { tap: DEFAULT_TAP, tnp: DEFAULT_TNP, lastSynced: null, therasabdab: ensureCombinedVHVL(DEFAULT_THERASABDAB) };
}

export function resetGuidelines() {
  const computed = computeGuidelines({});
  const thresholds = {
    tap: DEFAULT_TAP,
    tnp: DEFAULT_TNP,
    therasabdab: computed?.therasabdab || DEFAULT_THERASABDAB,
    therasabdabLastSynced: null,
    lastSynced: null
  };
  saveGuidelines(thresholds);
  return thresholds;
}

const parseNumbers = (str: string) => {
    const matches = str.match(/-?\d+(\.\d+)?/g);
    return matches ? matches.map(Number) : [];
};

async function scrapeTAP(url?: string) {
    try {
        const { data } = await axios.get(url || "https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabpred/tap", { timeout: 10000 });
        const $ = cheerio.load(data);
        const parsedTap: any = {};
        let currentProp = '';
        
        $('.table-results tr').each((i, row) => {
            const tds = $(row).find('td');
            if (tds.length === 3) {
                const propText = $(tds[0]).text().trim();
                if (propText !== '') {
                    currentProp = propText;
                }
                
                const amber = $(tds[1]).text().trim();
                const red = $(tds[2]).text().trim();
                const aNums = parseNumbers(amber);
                const rNums = parseNumbers(red);
                
                if (currentProp.includes('Total CDR Length')) {
                    if (!parsedTap['L_tot']) parsedTap['L_tot'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        if (rNums[0] < 50) {
                            parsedTap['L_tot'].red_low = rNums[0];
                            parsedTap['L_tot'].amber_low = aNums[1];
                        } else {
                            parsedTap['L_tot'].amber_high = aNums[0];
                            parsedTap['L_tot'].red_high = rNums[0];
                        }
                    }
                } else if (currentProp.includes('PSH')) {
                    if (!parsedTap['PSH']) parsedTap['PSH'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        if (rNums[0] < 120) {
                            parsedTap['PSH'].red_low = rNums[0];
                            parsedTap['PSH'].amber_low = aNums[1];
                        } else {
                            parsedTap['PSH'].amber_high = aNums[0];
                            parsedTap['PSH'].red_high = rNums[0];
                        }
                    }
                } else if (currentProp.includes('PPC')) {
                    if (!parsedTap['PPC']) parsedTap['PPC'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        parsedTap['PPC'].amber = aNums[0];
                        parsedTap['PPC'].red = rNums[0];
                    }
                } else if (currentProp.includes('PNC')) {
                    if (!parsedTap['PNC']) parsedTap['PNC'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        parsedTap['PNC'].amber = aNums[0];
                        parsedTap['PNC'].red = rNums[0];
                    }
                } else if (currentProp.includes('SFvCSP')) {
                    if (!parsedTap['SFvCSP']) parsedTap['SFvCSP'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        parsedTap['SFvCSP'].red = rNums[0];
                        parsedTap['SFvCSP'].amber_high = aNums[1];
                    }
                }
            }
        });
        return Object.keys(parsedTap).length > 0 ? parsedTap : null;
    } catch (e) {
        // console.warn("TAP Scrape failed", e.message);
        return null;
    }
}

async function scrapeTNP(url?: string) {
    try {
        const { data } = await axios.get(url || "https://opig.stats.ox.ac.uk/webapps/tnp", { timeout: 10000 });
        const $ = cheerio.load(data);
        const parsedTnp: any = {};
        let currentProp = '';
        
        $('.table-results tr').each((i, row) => {
            const tds = $(row).find('td');
            if (tds.length === 3) {
                const propText = $(tds[0]).text().trim();
                if (propText !== '') {
                    currentProp = propText;
                }
                const amber = $(tds[1]).text().trim();
                const red = $(tds[2]).text().trim();
                const aNums = parseNumbers(amber);
                const rNums = parseNumbers(red);
                
                if (currentProp.toLowerCase().includes('total cdr length')) {
                    if (!parsedTnp['L']) parsedTnp['L'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        if (rNums[0] < 30) {
                            parsedTnp['L'].red_low = rNums[0];
                            parsedTnp['L'].amber_low = aNums[1];
                        } else {
                            parsedTnp['L'].amber_high = aNums[0];
                            parsedTnp['L'].red_high = rNums[0];
                        }
                    }
                } else if (currentProp.toLowerCase().includes('cdr3 length')) {
                    if (!parsedTnp['L3']) parsedTnp['L3'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        if (rNums[0] < 10) {
                            parsedTnp['L3'].red_low = rNums[0];
                            parsedTnp['L3'].amber_low = aNums[1];
                        } else {
                            parsedTnp['L3'].amber_high = aNums[0];
                            parsedTnp['L3'].red_high = rNums[0];
                        }
                    }
                } else if (currentProp.toLowerCase().includes('compactness')) {
                    if (!parsedTnp['C']) parsedTnp['C'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        if (rNums[0] < 1.0) {
                            parsedTnp['C'].red_low = rNums[0];
                            parsedTnp['C'].amber_low = aNums[1];
                        } else {
                            parsedTnp['C'].amber_high = aNums[0];
                            parsedTnp['C'].red_high = rNums[0];
                        }
                    }
                } else if (currentProp.toLowerCase().includes('psh') || currentProp.toLowerCase().includes('hydrophobicity')) {
                    if (!parsedTnp['PSH']) parsedTnp['PSH'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        if (rNums[0] < 100) {
                            parsedTnp['PSH'].red_low = rNums[0];
                            parsedTnp['PSH'].amber_low = aNums[1];
                        } else {
                            parsedTnp['PSH'].amber_high = aNums[0];
                            parsedTnp['PSH'].red_high = rNums[0];
                        }
                    }
                } else if (currentProp.toLowerCase().includes('ppc') || currentProp.toLowerCase().includes('positive charge')) {
                    if (!parsedTnp['PPC']) parsedTnp['PPC'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        parsedTnp['PPC'].amber = aNums[0];
                        parsedTnp['PPC'].red = rNums[0];
                    }
                } else if (currentProp.toLowerCase().includes('pnc') || currentProp.toLowerCase().includes('negative charge')) {
                    if (!parsedTnp['PNC']) parsedTnp['PNC'] = {};
                    if (aNums.length === 2 && rNums.length === 1) {
                        parsedTnp['PNC'].amber = aNums[0];
                        parsedTnp['PNC'].red = rNums[0];
                    }
                }
            }
        });
        return Object.keys(parsedTnp).length > 0 ? parsedTnp : null;
    } catch (e) {
        // console.warn("TNP Scrape failed", e.message);
        return null;
    }
}

export async function syncGuidelines(urlTAP?: string, urlTNP?: string) {
    // Force use the absolute defaults
    const thresholds = {
        tap: DEFAULT_TAP,
        tnp: DEFAULT_TNP,
        therasabdab: DEFAULT_THERASABDAB,
        therasabdabLastSynced: new Date().toISOString(),
        lastSynced: new Date().toISOString()
    };
    saveGuidelines(thresholds);
    return thresholds;
}
