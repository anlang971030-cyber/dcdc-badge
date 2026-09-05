export const layoutState={items:[]};
export async function loadImages(files){
 for(const file of files){
  const url=URL.createObjectURL(file);
  layoutState.items.push({url,name:file.name,x:50,y:50,scale:100});
 }
 const box=document.querySelector('#direct-preview');
 if(box) box.innerHTML=layoutState.items.map(i=>`<img src="${i.url}" style="width:${i.scale}px;">`).join('');
}
