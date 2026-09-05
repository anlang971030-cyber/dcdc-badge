let cvReady = null;

async function loadCV(){
  if(cvReady) return cvReady;
  cvReady = new Promise((resolve,reject)=>{
    importScripts('https://docs.opencv.org/4.x/opencv.js');
    const timer=setInterval(()=>{
      if(self.cv && cv.Mat){clearInterval(timer);resolve(cv);}
    },100);
    setTimeout(()=>{clearInterval(timer);reject(new Error('OpenCV加载超时'));},30000);
  });
  return cvReady;
}

self.onmessage=async(e)=>{
 try{
  const cv=await loadCV();
  const bitmap=await createImageBitmap(e.data.image);
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
  const ctx=canvas.getContext('2d');
  ctx.drawImage(bitmap,0,0);
  const img=ctx.getImageData(0,0,canvas.width,canvas.height);
  const temp=document;
 }catch(err){
  self.postMessage({ok:false,error:err.message});
 }
};
