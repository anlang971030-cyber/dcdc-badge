export const directItems=[];
export function directEditorMarkup(){return `<section class="screen"><p class="eyebrow">DIRECT IMAGE</p><h2>上传心仪图片制作</h2><p class="lead">支持多张图片上传，在铭牌底图中调整位置和大小。</p><div class="field"><label>上传图片</label><input id="direct-files" type="file" multiple accept="image/*"></div><div class="direct-board">${directItems.map((x,i)=>`<div class="direct-item" style="left:${x.x}%;top:${x.y}%;transform:scale(${x.scale})"><img src="${x.url}"></div>`).join('')}</div><p>选择图片后可通过下面参数调整：</p>${directItems.map((x,i)=>`<div class="field"><label>图片${i+1} 缩放</label><input data-direct-scale="${i}" type="range" min="20" max="200" value="${x.scale*100}"></div>`).join('')}<div class="actions"><button class="btn btn-primary" data-action="image-badge">生成我的标识牌</button><button class="btn btn-ghost" data-action="choose-mode">返回</button></div></section>`}
export async function handleDirectFiles(files){for(const f of files){const url=URL.createObjectURL(f);directItems.push({url,x:50,y:50,scale:1});}}
export function updateDirectItem(i,s,v){if(directItems[i])directItems[i][s]=v}
export function removeDirectItem(i){directItems.splice(i,1)}
export function moveDirectItem(i,d){}
