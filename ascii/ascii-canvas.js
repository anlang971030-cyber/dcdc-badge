// ASCII renderer patch
export const DEFAULTS = Object.freeze({
  columns:120,
  fontSize:10,
  lineHeight:9,
  alphaThreshold:230,
  preset:'CUSTOM',
  customText:'DCDC数字创新设计研究中心\nDIGITAL CREATIVE DESIGN\nclass BadgeMaker {}',
  colorMode:'ORIGINAL',
  customColor:'#2E6CF6'
});

const presets = {
  CLASSIC:'@%#*+=-:.',
  DENSE:'@$B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,"^`.',
  BLOCK:'█▓▒░'
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||a));

export function buildPool(preset,text=''){
  const custom=Array.from(text).filter(c=>!/\s/u.test(c));
  return preset==='CUSTOM'&&custom.length?custom:Array.from(presets[preset]||presets.CLASSIC);
}

function canvas(w,h){
  const c=document.createElement('canvas');
  c.width=w;c.height=h;
  return c;
}

export async function readImage(file){
  if(!file) throw new Error('请选择图片');

  const url=URL.createObjectURL(file);
  const img=new Image();

  try{
    img.src=url;
    await img.decode();

    const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));

    const c=canvas(
      Math.round(img.naturalWidth*ratio),
      Math.round(img.naturalHeight*ratio)
    );

    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return c;

  }finally{
    URL.revokeObjectURL(url);
  }
}


/*
核心修改：
fontSize 不再改变输出图片尺寸。
fontSize = 像素块大小。
越大 -> 采样点越少 -> ASCII颗粒越大。
*/
export function renderAscii(source,options={}){

  const c={...DEFAULTS,...options};

  const blockSize=clamp(c.fontSize,6,32);

  // 根据字符大小反向计算采样数量
  // 小字符=更多像素点，大字符=更少像素点
  const columns=Math.round(
    clamp(c.columns,40,260) * 10 / blockSize
  );

  const line=clamp(c.lineHeight,6,40);
  const threshold=clamp(c.alphaThreshold,120,255);

  const rows=Math.max(
    1,
    Math.round(
      source.height/source.width*
      columns*
      0.62
    )
  );

  const sample=canvas(columns,rows);
  const sc=sample.getContext('2d',{willReadFrequently:true});
  sc.drawImage(source,0,0,columns,rows);

  const data=sc.getImageData(0,0,columns,rows).data;

  const outW=columns*blockSize*0.62+20;
  const outH=rows*line+20;

  const out=canvas(outW,outH);
  const ctx=out.getContext('2d');

  const tokens=buildPool(c.preset,c.customText);

  /*
  中文字体支持
  */
  ctx.font=
  `bold ${blockSize}px 
  "Microsoft YaHei",
  "Microsoft YaHei UI",
  "Noto Sans CJK SC",
  "PingFang SC",
  "SimHei",
  sans-serif`;

  ctx.textBaseline='top';

  let cursor=0;

  for(let y=0;y<rows;y++){

    for(let x=0;x<columns;x++){

      const i=(y*columns+x)*4;

      const rgb=[
        data[i],
        data[i+1],
        data[i+2]
      ];

      const alpha=data[i+3];

      if(alpha<20) continue;

      const gray=Math.round(
        .299*rgb[0]+
        .587*rgb[1]+
        .114*rgb[2]
      );


      if(gray>=threshold) continue;


      const token =
      c.preset==='CUSTOM'
      ?
      tokens[cursor++%tokens.length]
      :
      tokens[
        Math.floor(
          gray*(tokens.length-1)/255
        )
      ];


      let color=rgb;

      if(c.colorMode==='BLACK')
        color=[30,30,30];

      if(c.colorMode==='BLUE')
        color=[46,108,246];

      if(c.colorMode==='CUSTOM'){
        const hex=/^#[0-9a-f]{6}$/i.test(c.customColor)
        ?c.customColor:'#2E6CF6';

        color=[
          parseInt(hex.slice(1,3),16),
          parseInt(hex.slice(3,5),16),
          parseInt(hex.slice(5,7),16)
        ];
      }


      const a=Math.max(
        40,
        Math.min(
          255,
          alpha*(threshold-gray)/threshold
        )
      );

      ctx.fillStyle=
      `rgba(${color.join(',')},${a/255})`;


      ctx.fillText(
        token,
        10+x*blockSize*0.62,
        10+y*line
      );

    }
  }

  return cropTransparent(out);
}


function cropTransparent(img){

  const ctx=img.getContext('2d');
  const data=ctx.getImageData(
    0,0,img.width,img.height
  ).data;

  let minX=img.width;
  let minY=img.height;
  let maxX=-1;
  let maxY=-1;


  for(let y=0;y<img.height;y++){
    for(let x=0;x<img.width;x++){

      if(data[(y*img.width+x)*4+3]){

        minX=Math.min(minX,x);
        minY=Math.min(minY,y);
        maxX=Math.max(maxX,x);
        maxY=Math.max(maxY,y);

      }
    }
  }

  if(maxX<0)
    return img;


  const c=canvas(
    maxX-minX+12,
    maxY-minY+12
  );

  c.getContext('2d')
  .drawImage(
    img,
    minX-6,
    minY-6,
    c.width,
    c.height,
    0,
    0,
    c.width,
    c.height
  );

  return c;
}
