import { LiquidGlassEngine } from 'quick-liquid';

const art = document.querySelector('#art')!;
// The actual QuickLiquid lens renders each glyph. SVG masks trim only the
// effect layers; the host remains unmasked so it can sample the page backdrop.
const actors: {host:HTMLElement;x:number;y:number;phase:number}[]=[];
function glyph(char:string,x:number,y:number,w:number,h:number,size:number) {
 const host=document.createElement('div');host.className='glass';
 Object.assign(host.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});art.append(host);
 const star=char==='star';
 const shape=star ? '<path d="M100 10 123 69 186 73 138 114 152 177 100 143 48 177 62 114 14 73 77 69Z"/>' : `<text x="50%" y="${h*.79}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="${size}" letter-spacing="-8">${char}</text>`;
 const box=star?'0 0 200 200':`0 0 ${w} ${h}`;
 const mask='url("data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" fill="white">${shape}</svg>`)+'")';
 host.id='digit-'+x;
 const clip=document.createElementNS('http://www.w3.org/2000/svg','svg');clip.setAttribute('width','0');clip.setAttribute('height','0');clip.style.position='absolute';
 clip.innerHTML=`<defs><clipPath id="clip-${x}" clipPathUnits="userSpaceOnUse">${star?`<g transform="scale(${w/200} ${h/200})">${shape}</g>`:shape.replace('x="50%"',`x="${w/2}"`)}</clipPath></defs>`;art.append(clip);host.style.clipPath=`url(#clip-${x})`;
 const clipping=document.createElement('style');clipping.textContent=`#${host.id}>div:not(.ql-content){mask-image:${mask}!important;mask-size:100% 100%!important;mask-repeat:no-repeat!important}#${host.id}{box-shadow:none!important;background:transparent!important}`;document.head.append(clipping);
 new LiquidGlassEngine(host,{material:'clear',appearance:'light',blur:.3,refractionStrength:44,bezelWidth:70,borderRadius:110,chromaticAberration:.8,dispersionMode:'exact',saturation:1.65,tintOpacity:.015,edgeHighlight:1,specularStrength:.6,quality:'high',refractionMode:'svg',respectPreferences:false});
 const trim=()=>{host.style.boxShadow='none';host.style.background='transparent';for(const el of Array.from(host.children) as HTMLElement[]){if(!el.classList.contains('ql-content')&&el.tagName==='DIV') {el.style.maskImage=mask;el.style.maskSize='100% 100%';el.style.maskRepeat='no-repeat';}}};
 trim();setTimeout(trim,500);setTimeout(trim,1000);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',box);svg.classList.add('outline');
 const id='g'+x;
 svg.innerHTML=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#45515f"/><stop offset=".12" stop-color="#ffffff"/><stop offset=".2" stop-color="#d3dde6"/><stop offset=".28" stop-color="#fff"/><stop offset=".36" stop-color="#758998"/><stop offset=".43" stop-color="#b5eafa"/><stop offset=".48" stop-color="#d9bbeb"/><stop offset=".53" stop-color="#fbe5bc"/><stop offset=".6" stop-color="#fff"/><stop offset=".76" stop-color="#647482"/><stop offset=".84" stop-color="#fff"/><stop offset=".94" stop-color="#afbbc7"/><stop offset="1" stop-color="#fff"/></linearGradient><linearGradient id="${id}fill" x2=".75" y2="1"><stop stop-color="#ffffff" stop-opacity=".62"/><stop offset=".35" stop-color="#a0afbf" stop-opacity=".07"/><stop offset=".65" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#718094" stop-opacity=".23"/></linearGradient></defs><g fill="url(#${id}fill)" stroke="url(#${id})" stroke-width="${star?3:7}" stroke-linejoin="round">${shape}</g><g fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="1">${shape}</g>`;
 host.querySelector('.ql-content')!.append(svg);
 actors.push({host,x,y,phase:actors.length*.8});
 return host;
}
glyph('2',65,290,325,540,590);
glyph('0',355,290,325,540,590);
glyph('0',655,290,325,540,590);
glyph('+',951,444,205,335,305);
glyph('star',965,233,177,177,0);
// Moving page content is sampled by QuickLiquid's real SVG backdrop filter.
const lights=document.createElement('div');
lights.style.cssText='position:absolute;inset:0;pointer-events:none';
lights.innerHTML='<div class="moving-ribbon"></div><div class="moving-beam"></div><div class="moving-line"></div>';
art.insertBefore(lights,art.querySelector('.glass'));
const sheet=document.createElement('style');
sheet.textContent=`.moving-ribbon{position:absolute;left:-300px;top:400px;width:1800px;height:185px;background:linear-gradient(180deg,transparent,rgba(113,214,231,.44) 22%,rgba(157,164,237,.44) 43%,rgba(245,182,208,.42) 65%,rgba(253,224,158,.4) 83%,transparent);transform-origin:center}.moving-beam{position:absolute;left:-400px;top:230px;width:220px;height:660px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.94) 45%,rgba(118,152,173,.36) 49%,rgba(255,255,255,.95) 52%,transparent);transform:rotate(22deg)}.moving-line{position:absolute;left:-100px;top:640px;width:1400px;height:5px;background:linear-gradient(90deg,transparent,#7ea9b9 20%,#fff 46%,#fff 62%,#b6a9d2 82%,transparent);box-shadow:0 13px 0 #ffffffb0}`;
document.head.append(sheet);
function seek(ms:number){
 const u=ms/1000;const loop=u/10*Math.PI*2;
 for(const a of actors){const dx=Math.sin(loop+a.phase)*12;const dy=Math.sin(loop+a.phase+.5)*17;
 a.host.style.transform=`translate(${dx}px,${dy}px) rotate(${Math.sin(loop+a.phase)*1.4}deg)`;}
 (lights.children[0] as HTMLElement).style.transform=`translateY(${Math.sin(loop)*120}px) rotate(${-12+Math.sin(loop)*8}deg)`;
 (lights.children[1] as HTMLElement).style.transform=`translateX(${(u/10)*1750}px) rotate(22deg)`;
 (lights.children[2] as HTMLElement).style.transform=`translateY(${Math.sin(loop+1)*135}px) rotate(${-9+Math.sin(loop)*4}deg)`;
}
(window as unknown as {__STILL_VIDEO__:unknown}).__STILL_VIDEO__={seek,duration:10000};
const movie=new URLSearchParams(location.search).has('video');
if(!movie)lights.style.display='none';
document.fonts.ready.then(()=>{document.body.dataset.ready='true';if(movie)seek(0)});
