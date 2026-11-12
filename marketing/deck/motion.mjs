// Adds motion to a built deck, which pptxgenjs can't: a short fade between
// every slide, and click-by-click builds on the few talk slides where the
// order is the point. A shape joins a build by its name: give it
// `objectName: 'build:N'` (or 'build:N:anything') in the builder and it fades
// in on the Nth click; untagged shapes are there from the start. Run after
// applyTheme(). PDF exports and the .preview renders show every slide as it
// ends, so check builds in PowerPoint's slideshow.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const JSZip = require(require.resolve('jszip', { paths: [require.resolve('../tooling/node_modules/pptxgenjs')] }));

const FADE = '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
  '<mc:Choice xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" Requires="p14">' +
  '<p:transition spd="fast" p14:dur="300"><p:fade/></p:transition></mc:Choice>' +
  '<mc:Fallback><p:transition spd="fast"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>';

function timing(groups, kinds) {
  let id = 3;
  const effect = (spid, first) => {
    const a = id++, b = id++, c = id++;
    return `<p:par><p:cTn id="${a}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold"${kinds[spid] === 'sp' ? ' grpId="0"' : ''} nodeType="${first ? 'clickEffect' : 'withEffect'}">` +
      '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
      `<p:set><p:cBhvr><p:cTn id="${b}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
      '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>' +
      `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${c}" dur="400"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>` +
      '</p:childTnLst></p:cTn></p:par>';
  };
  const clicks = groups.map((ids) => {
    const a = id++, b = id++;
    const inner = ids.map((s, i) => effect(s, i === 0)).join('');
    return `<p:par><p:cTn id="${a}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>` +
      `<p:par><p:cTn id="${b}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${inner}</p:childTnLst></p:cTn></p:par>` +
      '</p:childTnLst></p:cTn></p:par>';
  }).join('');
  const bld = groups.flat().filter((s) => kinds[s] === 'sp').map((s) => `<p:bldP spid="${s}" grpId="0" animBg="1"/>`).join('');
  return '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clicks}</p:childTnLst></p:cTn>` +
    '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
    '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>' +
    `</p:childTnLst></p:cTn></p:par></p:tnLst>${bld ? `<p:bldLst>${bld}</p:bldLst>` : ''}</p:timing>`;
}

/** Returns the number of slides given builds. */
export async function applyMotion(deckPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(deckPath));
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  let built = 0;
  for (const f of slides) {
    let xml = await zip.file(f).async('string');
    if (xml.includes('<p:transition') || xml.includes('<p:timing')) continue; // already done
    // Tagged shapes, by click: <p:sp> or <p:pic> whose cNvPr is named build:N.
    const groups = new Map(), kinds = {};
    for (const m of xml.matchAll(/<p:(sp|pic|graphicFrame|cxnSp)>\s*<p:nv\w+Pr>\s*<p:cNvPr id="(\d+)" name="build:(\d+)[^"]*"/g)) {
      const [, kind, spid, n] = m;
      kinds[spid] = kind;
      if (!groups.has(+n)) groups.set(+n, []);
      groups.get(+n).push(spid);
    }
    let add = FADE;
    if (groups.size) { add += timing([...groups.keys()].sort((a, b) => a - b).map((k) => groups.get(k)), kinds); built++; }
    // transition and timing go after clrMapOvr, before any extLst
    xml = xml.includes('<p:extLst>') && xml.lastIndexOf('<p:extLst>') > xml.indexOf('</p:clrMapOvr>')
      ? xml.replace(/(<\/p:clrMapOvr>)/, `$1${add}`)
      : xml.replace('</p:sld>', `${add}</p:sld>`);
    zip.file(f, xml);
  }
  fs.writeFileSync(deckPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return built;
}
