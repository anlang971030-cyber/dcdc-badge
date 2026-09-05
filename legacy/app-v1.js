const STORAGE_KEY = 'dcdc-badge-v1';
const PALETTE = ['#70DDE6', '#C5EDF0', '#BDD8F2', '#91A8E5', '#C9BDE5', '#123D6A'];
const DEFAULT_DATA = {
  name: '', role: '', group: '科研组', customGroup: '', specialty: '', keyword: '', confirmed: false,
  pattern: 'organic', color: 'auto', density: 'balanced', variation: 0, selected: 0
};

const app = document.querySelector('#app');
const saved = safeParse(localStorage.getItem(STORAGE_KEY));
const state = { step: 1, data: { ...DEFAULT_DATA, ...(saved?.data || {}) }, previews: [], lightbox: null };
let baseImage;

function safeParse(value) { try { return JSON.parse(value); } catch { return null; } }
function esc(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function persist(extra = {}) { localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: state.data, ...extra })); }
function effectiveGroup() { return state.data.group === '其他' ? state.data.customGroup.trim() : state.data.group; }
function chineseLength(value) { return [...value.trim()].length; }

function hash32(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
  return h >>> 0;
}

function seedFor(offset = 0) {
  const d = state.data;
  const key = [d.name, d.role, effectiveGroup(), d.specialty, d.keyword, d.pattern, d.color, d.density].join('|');
  return (hash32(key) + d.variation * 97 + offset) >>> 0;
}

function rng(seed) { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
function pickPalette(seed) {
  const palettes = {
    cyan: ['#70DDE6','#C5EDF0','#BDD8F2','#123D6A'],
    blue: ['#BDD8F2','#91A8E5','#C5EDF0','#123D6A'],
    purple: ['#C9BDE5','#91A8E5','#BDD8F2','#123D6A'],
    auto: [...PALETTE.slice(0, 5), '#123D6A']
  };
  const a = [...palettes[state.data.color]];
  const shift = seed % (a.length - 1 || 1);
  return [...a.slice(shift, -1), ...a.slice(0, shift), a[a.length - 1]];
}

function svgDefs(colors, id) {
  return `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[2]}"/></linearGradient><linearGradient id="h${id}" x1="1" y1="0" x2="0" y2="1"><stop stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[3]}" stop-opacity=".65"/></linearGradient><clipPath id="clip${id}"><rect width="1000" height="700"/></clipPath></defs>`;
}

function dots(random, color, count, spread = 1) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = 120 + random() * 820 * spread, y = 70 + random() * 570, r = 3 + random() * 7;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(.25 + random()*.4).toFixed(2)}"/>`;
  }
  return out;
}

function organicPreset(index, r, c, id, density) {
  if (index === 0) return `<ellipse cx="680" cy="330" rx="240" ry="190" fill="url(#g${id})" opacity=".62"/><ellipse cx="480" cy="520" rx="235" ry="180" fill="${c[0]}" opacity=".36"/><ellipse cx="855" cy="525" rx="265" ry="210" fill="url(#h${id})" opacity=".42"/>${dots(r,c[3],density)}`;
  if (index === 1) return `<path d="M290 610 C390 360 450 160 710 130 C900 110 1030 230 1030 230 L1030 700 L270 700Z" fill="url(#g${id})" opacity=".32"/><path d="M280 630 C450 560 390 260 690 210 C860 181 930 80 1025 30" fill="none" stroke="${c[3]}" stroke-width="3" opacity=".55"/><path d="M390 690 C620 520 540 330 790 310 C930 300 960 210 1040 160" fill="none" stroke="${c[0]}" stroke-width="18" opacity=".36"/>${dots(r,c[2],Math.floor(density*.7))}`;
  if (index === 2) return `<circle cx="855" cy="170" r="250" fill="url(#g${id})" opacity=".42"/><path d="M180 690 C350 420 570 600 720 250 C820 20 1040 65 1100 10" fill="none" stroke="${c[1]}" stroke-width="105" opacity=".56"/><path d="M280 700 C470 510 650 640 790 330 C870 150 970 130 1080 90" fill="none" stroke="${c[3]}" stroke-width="3" opacity=".52"/>${dots(r,c[0],Math.floor(density*.6))}`;
  return `<path d="M210 520 C340 300 470 670 620 410 S820 140 1040 230" fill="none" stroke="url(#g${id})" stroke-width="72" opacity=".35"/><path d="M190 470 C360 230 430 610 610 350 S845 95 1040 175" fill="none" stroke="${c[3]}" stroke-width="3" opacity=".5"/>${dots(r,c[2],Math.floor(density*1.25))}`;
}

function geometricPreset(index, r, c, id, density) {
  if (index === 0) return `<circle cx="735" cy="340" r="255" fill="none" stroke="url(#g${id})" stroke-width="115" opacity=".52"/><path d="M455 590 A230 230 0 0 1 800 390" fill="none" stroke="${c[3]}" stroke-width="72" opacity=".35"/><circle cx="735" cy="340" r="120" fill="${c[1]}" opacity=".28"/>${dots(r,c[0],Math.floor(density*.6))}`;
  if (index === 1) { let s=''; for(let y=0;y<4;y++) for(let x=0;x<4;x++){const cx=465+x*125,cy=165+y*125,q=(x+y)%4;s+=q===0?`<circle cx="${cx}" cy="${cy}" r="45" fill="${c[(x+y)%3]}" opacity=".48"/>`:q===1?`<path d="M${cx-45} ${cy+45} A90 90 0 0 1 ${cx+45} ${cy-45}" fill="none" stroke="${c[(x+y)%3]}" stroke-width="32" opacity=".5"/>`:`<rect x="${cx-38}" y="${cy-38}" width="76" height="76" rx="${q===2?8:38}" fill="${c[(x+y)%3]}" opacity=".32"/>`; } return s; }
  if (index === 2) return `<g transform="translate(690 350)"><path d="M0 -260 L160 -150 L245 20 L145 215 L0 270 L-145 215 L-245 20 L-160 -150Z" fill="url(#g${id})" opacity=".27"/><circle r="165" fill="none" stroke="${c[3]}" stroke-width="42" opacity=".5"/><path d="M-175 80 Q0 -110 175 80 M-130 -120 Q0 60 130 -120" fill="none" stroke="${c[0]}" stroke-width="24" opacity=".58"/></g>${dots(r,c[2],Math.floor(density*.45))}`;
  return `<path d="M520 120 A250 250 0 1 0 520 580" fill="none" stroke="${c[2]}" stroke-width="86" opacity=".38"/><path d="M790 110 A245 245 0 1 0 790 590" fill="none" stroke="url(#g${id})" stroke-width="102" opacity=".48"/><path d="M500 170 A200 200 0 1 0 500 530 M810 170 A200 200 0 1 0 810 530" fill="none" stroke="${c[3]}" stroke-width="3" opacity=".45"/>`;
}

function dataPreset(index, r, c, id, density) {
  let contours=''; for(let i=0;i<8;i++){const y=80+i*72+(r()-.5)*25;contours+=`<path d="M250 ${y} C410 ${y-100+r()*120} 510 ${y+90-r()*150} 690 ${y-10} S900 ${y-120+r()*160} 1060 ${y+20}" fill="none" stroke="${c[i%3]}" stroke-width="${1.5+i%3}" opacity="${(.32+i*.025).toFixed(2)}"/>`;}
  if (index === 0) return `<path d="M520 30 C760 140 710 350 1000 410 L1000 700 L610 700 C760 510 400 330 520 30Z" fill="url(#g${id})" opacity=".22"/>${contours}${dots(r,c[3],density)}`;
  if (index === 1) { let lines=''; for(let i=0;i<6;i++){const y=120+i*90;lines+=`<path d="M250 ${y} C430 ${y+(r()-.5)*120} 560 ${y-90} 760 ${y+20} S930 ${y+(r()-.5)*150} 1060 ${y-40}" fill="none" stroke="${c[i%3]}" stroke-width="${i%2?3:8}" opacity=".45"/>`; } return `${lines}${dots(r,c[3],Math.floor(density*1.15))}`; }
  if (index === 2) { let field=''; const cols=state.data.density==='airy'?11:state.data.density==='rich'?19:15; for(let y=0;y<9;y++) for(let x=0;x<cols;x++){const scale=.35+.65*(x/cols);field+=`<circle cx="${300+x*47}" cy="${120+y*58}" r="${(2+r()*5*scale).toFixed(1)}" fill="${c[(x+y)%3]}" opacity="${(.25+scale*.42).toFixed(2)}"/>`; } return `<ellipse cx="790" cy="350" rx="330" ry="270" fill="url(#g${id})" opacity=".12"/>${field}`; }
  return `<path d="M450 700 Q560 500 510 320 T750 30 L1040 0 L1040 700Z" fill="url(#h${id})" opacity=".22"/>${contours}${dots(r,c[3],Math.floor(density*1.2))}`;
}

function createPatternSvg(seed) {
  const r = rng(seed), colors = pickPalette(seed), index = seed % 4;
  const density = state.data.density === 'airy' ? 20 : state.data.density === 'rich' ? 52 : 34;
  const id = `p${seed.toString(16)}`;
  const angle = [-8,-4,0,4,7][Math.floor(r()*5)];
  const mirror = r() > .68 ? -1 : 1;
  const generator = state.data.pattern === 'organic' ? organicPreset : state.data.pattern === 'geometric' ? geometricPreset : dataPreset;
  const body = generator(index, r, colors, id, density);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700">${svgDefs(colors,id)}<g clip-path="url(#clip${id})" transform="translate(${mirror<0?1000:0} 0) scale(${mirror} 1) rotate(${angle} 680 350)">${body}</g></svg>`;
}

async function loadImage(src) { return new Promise((resolve,reject) => { const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=src; }); }
async function ensureBase() { if (!baseImage) baseImage = await loadImage('./assets/template-base.png'); return baseImage; }
function drawSpacedText(ctx, text, x, y, spacing) { for (const ch of text) { ctx.fillText(ch,x,y); x += ctx.measureText(ch).width + spacing; } }

async function renderBadge(seed, scale = 1) {
  const canvas = document.createElement('canvas'); canvas.width = 2000*scale; canvas.height = 900*scale;
  const ctx = canvas.getContext('2d'); ctx.scale(scale,scale);
  ctx.drawImage(await ensureBase(), 0, 0, 2000, 900);
  const svg = createPatternSvg(seed);
  const patternUrl = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
  const pattern = await loadImage(patternUrl);
  ctx.save(); ctx.beginPath(); ctx.rect(930,110,1070,730); ctx.clip(); ctx.drawImage(pattern, 930, 110, 1070, 749); ctx.restore(); URL.revokeObjectURL(patternUrl);
  const font = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillStyle='#123D6A'; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  const n = chineseLength(state.data.name), nameSize = n <= 4 ? 96 : n === 5 ? 80 : 68;
  ctx.font=`700 ${nameSize}px ${font}`; ctx.fillText(state.data.name,100,480,760);
  ctx.font=`600 42px ${font}`; ctx.fillText(state.data.role,105,590,760);
  ctx.font=`500 28px ${font}`; ctx.fillText(`${effectiveGroup()} · ${state.data.specialty}`,105,670,780);
  ctx.font=`500 14px ${font}`; ctx.globalAlpha=.68; drawSpacedText(ctx,`DCDC DIGITAL ID · ${String(seed).padStart(10,'0')}`,105,830,3.2); ctx.globalAlpha=1;
  return canvas;
}

async function generatePreviews() {
  state.previews = [];
  for (let i=0;i<3;i++) { const c=await renderBadge(seedFor(i),.5); state.previews.push(c.toDataURL('image/png')); }
}

function validateInfo(show = true) {
  const d=state.data, errors={};
  if (!/^[\u3400-\u9fff]{2,6}$/.test(d.name.trim())) errors.name='请输入 2—6 个汉字';
  if (!d.role.trim() || chineseLength(d.role)>10) errors.role='岗位必填，且不超过 10 个字';
  if (d.group==='其他' && (!d.customGroup.trim() || chineseLength(d.customGroup)>10)) errors.customGroup='请输入不超过 10 个字的组别';
  if (!d.specialty.trim() || chineseLength(d.specialty)>12) errors.specialty='专业方向必填，且不超过 12 个字';
  if (chineseLength(d.keyword)>12) errors.keyword='个性关键词不超过 12 个字';
  if (!d.confirmed) errors.confirmed='请先确认信息准确';
  if (show) document.querySelectorAll('[data-error]').forEach(el => el.textContent=errors[el.dataset.error]||'');
  return Object.keys(errors).length===0;
}

const brand = `<div class="brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>我的数创标识牌</span></div>`;
function shell(content, step = state.step) { return `<div class="app-shell"><header class="topbar">${brand}<span class="step-count">${step}/5</span></header><div class="progress" aria-hidden="true"><span style="width:${step*20}%"></span></div>${content}</div>`; }

function render() {
  const d=state.data;
  if (state.step===1) app.innerHTML=shell(`<section class="screen welcome"><div class="welcome-visual" aria-hidden="true"><i class="orb one"></i><i class="orb two"></i><i class="orb three"></i></div><h1>让每一张标识牌<br>都有自己的秩序</h1><p class="lead">填写基础信息并回答三个视觉问题，生成三款专属 DCDC 员工标识牌。</p><button class="btn btn-primary" data-action="start">开始生成</button></section>`);
  if (state.step===2) app.innerHTML=shell(`<section class="screen"><h2>填写员工信息</h2><p class="lead">信息只保存在当前浏览器中，不会上传。</p><div class="stack">
    ${field('name','姓名','例如：林知夏',d.name,'2—6 个汉字',6)}${field('role','岗位','例如：科技管理',d.role,'不超过 10 个字',10)}
    <div class="field"><label for="group">所在组别</label><select id="group"><option ${d.group==='研发组'?'selected':''}>研发组</option><option ${d.group==='产品组'?'selected':''}>产品组</option><option ${d.group==='科研组'?'selected':''}>科研组</option><option ${d.group==='运营组'?'selected':''}>运营组</option><option ${d.group==='其他'?'selected':''}>其他</option></select></div>
    ${d.group==='其他'?field('customGroup','自定义组别','请输入组别',d.customGroup,'不超过 10 个字',10):''}
    ${field('specialty','专业方向','例如：建筑数字化',d.specialty,'不超过 12 个字',12)}${field('keyword','个性关键词（选填）','例如：理性、开放',d.keyword,'不超过 12 个字',12)}
    <label class="check"><input id="confirmed" type="checkbox" ${d.confirmed?'checked':''}><span>我已确认以上信息准确</span></label><div class="error" data-error="confirmed"></div>
  </div><div class="actions split"><button class="btn btn-ghost" data-action="back">返回</button><button class="btn btn-primary" data-action="to-prefs">下一步</button></div></section>`);
  if (state.step===3) app.innerHTML=shell(`<section class="screen"><h2>选择视觉偏好</h2><p class="lead">三个答案将稳定映射为你的个性图案。</p>${question('图案类型','pattern',[['organic','有机渐变'],['geometric','几何图腾'],['data','数据线条']],d.pattern)}${question('色彩倾向','color',[['cyan','青色'],['blue','蓝色'],['purple','紫色'],['auto','自动搭配']],d.color)}${question('视觉密度','density',[['airy','留白'],['balanced','平衡'],['rich','丰富']],d.density)}<div class="actions split"><button class="btn btn-ghost" data-action="back">返回修改</button><button class="btn btn-primary" data-action="generate">生成三款方案</button></div></section>`);
  if (state.step===4) app.innerHTML=shell(`<section class="screen"><h2>选择你的方案</h2><p class="lead">A、B、C 使用相邻种子生成，信息一致但构图不同。</p><div class="tabs" role="tablist">${['A','B','C'].map((x,i)=>`<button class="tab ${i===d.selected?'active':''}" role="tab" aria-selected="${i===d.selected}" data-select="${i}">方案 ${x}</button>`).join('')}</div><div class="preview-wrap"><figure class="preview-card"><img src="${state.previews[d.selected]}" alt="方案 ${['A','B','C'][d.selected]} 标识牌预览" data-action="zoom"></figure><p class="preview-note">点击标识牌查看大图</p></div><div class="summary"><span class="chip">${esc(d.name)}</span><span class="chip">${esc(d.pattern==='organic'?'有机渐变':d.pattern==='geometric'?'几何图腾':'数据线条')}</span><span class="chip">第 ${d.variation+1} 组</span></div><div class="actions"><button class="btn btn-primary" data-action="confirm">确认使用方案 ${['A','B','C'][d.selected]}</button><div class="actions split" style="margin-top:0"><button class="btn btn-ghost" data-action="edit">返回修改</button><button class="btn btn-secondary" data-action="regenerate">换一组</button></div></div></section>`);
  if (state.step===5) app.innerHTML=shell(`<section class="screen success"><div class="success-dot" aria-hidden="true">✓</div><h2>标识牌已确认</h2><p class="lead">高清文件为 2000×900 PNG，可直接下载或打开后长按保存。</p><div class="preview-wrap"><figure class="preview-card"><img src="${state.previews[d.selected]}" alt="最终标识牌预览" data-action="zoom"></figure></div><div class="actions"><button class="btn btn-primary" data-action="download">下载标识牌</button><button class="btn btn-secondary" data-action="open-image">打开高清图片</button><button class="btn btn-ghost" data-action="edit">返回修改</button></div><p class="save-tip">微信内若无法直接下载，请点“打开高清图片”，再长按图片保存到相册。</p></section>`);
  if (state.lightbox) app.insertAdjacentHTML('beforeend',`<div class="lightbox" role="dialog" aria-modal="true" aria-label="标识牌大图"><button class="lightbox-close" aria-label="关闭" data-action="close-zoom">×</button><img src="${state.lightbox}" alt="高清标识牌"></div>`);
}

function field(id,label,placeholder,value,hint,max) { return `<div class="field"><label for="${id}">${label} <span class="hint">${hint}</span></label><input id="${id}" maxlength="${max}" value="${esc(value)}" placeholder="${placeholder}" autocomplete="off"><div class="error" data-error="${id}"></div></div>`; }
function question(title,key,options,value) { return `<div class="question"><div class="question-title">${title}</div><div class="choices">${options.map(([v,l])=>`<button class="choice" aria-pressed="${v===value}" data-choice="${key}:${v}">${l}</button>`).join('')}</div></div>`; }

app.addEventListener('input', e => { if (e.target.id in state.data) state.data[e.target.id]=e.target.value; if (e.target.id==='confirmed') state.data.confirmed=e.target.checked; persist(); });
app.addEventListener('change', e => { if (e.target.id==='group') { state.data.group=e.target.value; persist(); render(); } if(e.target.id==='confirmed'){state.data.confirmed=e.target.checked; persist();} });
app.addEventListener('click', async e => {
  const choice=e.target.closest('[data-choice]'); if(choice){const [k,v]=choice.dataset.choice.split(':');state.data[k]=v;persist();render();return;}
  const select=e.target.closest('[data-select]'); if(select){state.data.selected=Number(select.dataset.select);persist();render();return;}
  const a=e.target.closest('[data-action]'); if(!a)return;
  if(a.dataset.action==='start'){state.step=2;render();}
  if(a.dataset.action==='back'){state.step=Math.max(1,state.step-1);render();}
  if(a.dataset.action==='to-prefs' && validateInfo()){persist();state.step=3;render();}
  if(a.dataset.action==='generate'){a.disabled=true;a.textContent='正在生成…';state.data.variation=0;state.data.selected=0;await generatePreviews();persist();state.step=4;render();}
  if(a.dataset.action==='regenerate'){a.disabled=true;state.data.variation++;state.data.selected=0;await generatePreviews();persist();render();}
  if(a.dataset.action==='edit'){state.step=2;render();}
  if(a.dataset.action==='confirm'){persist({confirmedSeed:seedFor(state.data.selected),confirmedAt:new Date().toISOString()});state.step=5;render();}
  if(a.dataset.action==='zoom'){state.lightbox=state.previews[state.data.selected];render();}
  if(a.dataset.action==='close-zoom'){state.lightbox=null;render();}
  if(a.dataset.action==='download' || a.dataset.action==='open-image'){
    a.disabled=true;const canvas=await renderBadge(seedFor(state.data.selected),1);const url=canvas.toDataURL('image/png');
    if(a.dataset.action==='download'){const link=document.createElement('a');link.download=`DCDC-${state.data.name}-方案${['A','B','C'][state.data.selected]}.png`;link.href=url;link.click();}
    else {state.lightbox=url;render();}
    a.disabled=false;
  }
});

render();
