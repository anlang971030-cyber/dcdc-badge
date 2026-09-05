// Browser port of AsciiGeneratorService, TextCharacterPoolService and ColorUtils.
export const DEFAULTS = Object.freeze({ columns:120, fontSize:10, lineHeight:9, alphaThreshold:230, invert:false, preset:'CUSTOM', customText:'DCDC数字创新设计研究中心\nDIGITAL CREATIVE DESIGN\nclass BadgeMaker {}', colorMode:'ORIGINAL', customColor:'#2E6CF6' });
export const COPY = Object.freeze({ title:'图片定制标识卡', badgeLabel:'图片定制', personaZh:'', personaEn:'', hint:'图片仅在当前浏览器处理，不会上传。亮背景会转为透明。' });
const presets = { CLASSIC:'@%#*+=-:.', DENSE:'@$B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,"^`\'.', BLOCK:'█▓▒░' };
export function buildPool(preset, text='') {
  const custom = Array.from(text).filter(c => !/\s/u.test(c));
  return preset === 'CUSTOM' && custom.length ? custom : Array.from(presets[preset] || presets.CLASSIC);
}
function canvas(w,h) { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||a));
export async function readImage(file) {
  if (!file || file.size > 20*1024*1024) throw new Error('请选择不超过 20 MB 的图片。');
  if (!['image/png','image/jpeg','image/webp','image/gif','image/bmp'].includes(file.type)) throw new Error('请选择 PNG、JPEG、WebP、GIF 或 BMP 图片。');
  const url=URL.createObjectURL(file), img=new Image();
  try {
    img.src=url; await img.decode();
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth*img.naturalHeight>40000000) throw new Error('图片尺寸过大，请缩小至 4000 万像素以内。');
    const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const c=canvas(Math.max(1,Math.round(img.naturalWidth*ratio)),Math.max(1,Math.round(img.naturalHeight*ratio)));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height); return c;
  } catch(e) { throw new Error(e.message.includes('像素') ? e.message : '无法读取图片，请选择有效的图片文件。'); }
  finally { URL.revokeObjectURL(url); img.src=''; }
}
export function renderAscii(source, options={}) {
  const c={...DEFAULTS,...options}, columns=clamp(c.columns,40,260), size=clamp(c.fontSize,6,32), line=clamp(c.lineHeight,6,40), threshold=clamp(c.alphaThreshold,120,255);
  const cw=size*0.62, rows=Math.max(1,Math.round(source.height/source.width*columns*cw/line));
  const ow=Math.round(columns*cw)+20, oh=rows*line+20;
  if (ow>8192 || oh>8192 || ow*oh>8000000 || columns*rows>250000) throw new Error('当前图片比例或参数产生的画布过大，请降低列数、字号或裁剪原图。');
  const sample=canvas(columns,rows), sc=sample.getContext('2d',{willReadFrequently:true});
  sc.drawImage(source,0,0,columns,rows);
  const data=sc.getImageData(0,0,columns,rows).data;
  const corners=[0,columns-1,(rows-1)*columns,columns*rows-1].filter(i=>data[i*4+3]>=20);
  const bg=[0,1,2].map(k=>corners.length?Math.floor(corners.reduce((sum,i)=>sum+data[i*4+k],0)/corners.length):255);
  const out=canvas(ow,oh), ctx=out.getContext('2d',{willReadFrequently:true}), tokens=buildPool(c.preset,c.customText);
  ctx.font=`bold ${size}px Consolas, "Microsoft YaHei", "PingFang SC", monospace`;
  let cursor=0;
  for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {
    const i=(y*columns+x)*4, rgb=Array.from(data.slice(i,i+3)), a=data[i+3];
    if(a<20) continue;
    let gray=Math.round(.299*rgb[0]+.587*rgb[1]+.114*rgb[2]); if(c.invert) gray=255-gray;
    const near=Math.hypot(...rgb.map((v,k)=>v-bg[k]))<30;
    if(gray>=threshold || (near && gray>Math.min(245,threshold-5))) continue;
    const token=c.preset==='CUSTOM'?tokens[cursor++%tokens.length]:tokens[Math.floor(gray*(tokens.length-1)/255)];
    const alpha=Math.max(40,Math.min(255,Math.floor(a*(threshold-gray)/threshold)));
    let color=rgb;
    if(c.colorMode==='BLACK') color=[30,30,30];
    if(c.colorMode==='BLUE') color=[46,108,246];
    if(c.colorMode==='CUSTOM') { const hex=/^#[0-9a-f]{6}$/i.test(c.customColor)?c.customColor:'#2E6CF6'; color=[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)); }
    ctx.fillStyle=`rgba(${color.join(',')},${alpha/255})`;
    // Fit wide CJK glyphs into the same cell, keeping the source aspect ratio.
    ctx.fillText(token,10+Math.round(x*cw),10+(y+1)*line,cw);
  }
  const pixels=ctx.getImageData(0,0,ow,oh).data;
  let minX=ow,minY=oh,maxX=-1,maxY=-1;
  for(let y=0;y<oh;y++) for(let x=0;x<ow;x++) if(pixels[(y*ow+x)*4+3]) {minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  if(maxX<0) throw new Error('字符画全透明：请提高透明阈值、尝试反相，或换一张主体更清晰的图片。');
  minX=Math.max(0,minX-6);minY=Math.max(0,minY-6);maxX=Math.min(ow-1,maxX+6);maxY=Math.min(oh-1,maxY+6);
  const cropped=canvas(maxX-minX+1,maxY-minY+1);
  cropped.getContext('2d').drawImage(out,minX,minY,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
  sample.width=out.width=1; return cropped;
}
