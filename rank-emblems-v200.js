/* The existing thirty clan emblems, shared with the rankings. */
var LudusClanEmblems=(()=>{
const laurel='<path d="M41 85C16 77 8 50 25 20M59 85C84 77 92 50 75 20" fill="none" stroke="currentColor" stroke-width="3"/><path d="m23 66-14-9 4 16 15 4m-8-24L9 40l-1 16 14 8m0-24L17 24l-5 13 12 11m4-20 1-16-10 11 6 13m52 30 14-9-4 16-15 4m8-24 11-13 1 16-14 8m0-24 5-16 5 13-12 11m-4-20-1-16 10 11-6 13"/>';
const sword='<path d="M47 16 50 7l3 9v50h-6zM33 66h34v6H33zM46 74h8v16h-8z"/><circle cx="50" cy="92" r="5"/>';
const wing='<path d="M45 44 15 16 7 19l20 32-21-5 19 16 20-7M55 44l30-28 8 3-20 32 21-5-19 16-20-7"/>';
const rows=[
 ['Kartal',wing+'<path d="M42 40 49 29l13 8-9 3 3 20 8 22-14-9-14 9 8-24z"/>'],
 ['Defne',laurel+'<circle cx="50" cy="46" r="14"/><path d="M41 59h18l-9 21z"/>'],
 ['Aslan','<path d="m50 7 14 10 16-1-1 18 12 16-15 13-4 20-22 11-22-11-4-20L9 50l12-16-1-18 16 1z"/><path d="m32 33 13 8-7 8m30-16-13 8 7 8M34 62l16 12 16-12M42 55l8 5 8-5" fill="none" stroke="var(--crest-bg,#791c2a)" stroke-width="5"/>'],
 ['Kurt','<path d="m22 11 23 17h10l23-17-5 31 10 17-18 24-15 8-15-8-18-24 10-17z"/><path d="m31 47 13 6m25-6-13 6M39 65l11 12 11-12" fill="none" stroke="var(--crest-bg,#791c2a)" stroke-width="5"/>'],
 ['Miğfer','<path d="M49 13C24 13 15 40 20 65l13 6 4-20h26l4 20 13-6c5-25-4-52-29-52zM41 7h18l-2 10H43zM38 55h9v31l-17-8zM53 55h9l8 23-17 8z"/>'],
 ['Çapraz kılıçlar','<g transform="rotate(-37 50 50)">'+sword+'</g><g transform="rotate(37 50 50)">'+sword+'</g>'],
 ['Trident','<path d="M46 20h8v69h-8zM18 13l-6 15h11l5 24 18 5V45l-9-2-5-24h9L25 7zM82 13l6 15H77l-5 24-18 5V45l9-2 5-24h-9L75 7zM50 4l-9 22h18z"/>'],
 ['Colosseum','<path d="M12 32Q50 7 88 32v50H12z"/><g fill="var(--crest-bg,#791c2a)"><path d="M20 48v-8q5-12 10 0v8zm25 0v-8q5-12 10 0v8zm25 0v-8q5-12 10 0v8zM20 74v-9q5-12 10 0v9zm25 0v-9q5-12 10 0v9zm25 0v-9q5-12 10 0v9z"/></g>'],
 ['Güneş','<circle cx="50" cy="50" r="22"/><path d="M46 7h8v15h-8zm0 71h8v15h-8zM7 46h15v8H7zm71 0h15v8H78zM18 12l15 15-6 6-15-15zm55 55 15 15-6 6-15-15zM12 82l15-15 6 6-15 15zm55-55 15-15 6 6-15 15z"/>'],
 ['Ay','<path d="M70 12C27 1 5 46 28 76s63 15 66-17C65 80 29 43 70 12z"/><path d="m73 21 4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z"/>'],
 ['Akrep','<path d="M50 29c-16 0-21 16-16 30l16 14 16-14c5-14 0-30-16-30zM18 26 8 12 5 33l11 15 18-7-4-8-11 4zm64 0 10-14 3 21-11 15-18-7 4-8 11 4zM45 74c-8 18 17 19 25 5l11-20-8-13-5 7 5 9-10 15-9 3z"/><path d="m34 48-20 9m21-1-21 16m23-10L22 83m44-35 20 9m-21-1 21 16m-23-10 15 21" fill="none" stroke="currentColor" stroke-width="5"/>'],
 ['Anka',wing+'<path d="m50 21-8 13 4 20-18 34 22-17 22 17-18-34 4-17 8-2z"/><path d="m43 16 7-10 7 10" fill="none" stroke="currentColor" stroke-width="4"/>'],
 ['Kalkan','<path d="M15 15Q50 2 85 15v34Q78 75 50 94 22 75 15 49z"/><path d="M25 25h50v23Q69 68 50 82 31 68 25 48z" fill="none" stroke="var(--crest-bg,#791c2a)" stroke-width="5"/>'],
 ['Zafer kupası','<path d="M29 13h42v22c0 16-9 26-17 30v12h15v10H31V77h15V65c-8-4-17-14-17-30z"/><path d="M29 23H13v14q0 20 23 20M71 23h16v14q0 20-23 20" fill="none" stroke="currentColor" stroke-width="6"/>'],
 ['Kanatlı kılıç',wing+'<g transform="translate(0 4) scale(1 .85)">'+sword+'</g>'],
 ['Boğa','<path d="M30 30Q12 31 10 6q-12 32 18 44l7 30 15 14 15-14 7-30Q102 38 90 6q-2 25-20 24z"/><path d="m31 52 13 5m25-5-13 5M40 74h20" stroke="var(--crest-bg,#791c2a)" stroke-width="5"/>'],
 ['Şahlanmış at','<path d="m30 83 11-22-18-7 8-14 16-9 11-18 4-10 8 17 15 9-3 10-15-4-6 11 6 23-14 16-6-5 10-17-6-10-7 17-2 19-9 7zM18 47l-9-9 3-19 8 1-3 14 15 3z"/>'],
 ['Ejderha','<path d="m43 39 18-23 6-12 5 16 17 3-11 10-13-2-12 17 11 8-6 19-30 10-13-5 4-7 13 2 18-10-7-10-18 1L7 73 13 39l17-13 6 22zM65 56l23-11-1 20-22 10z"/>'],
 ['Yılan','<path d="M70 9Q33-2 29 29c-3 23 30 16 33 30S45 84 30 77l-9-11-9 6Q30 107 65 82c31-28-20-43-21-53-1-10 12-13 20-8l4 9 17-2 8-8-13-2z"/>'],
 ['Palmiye','<path d="M47 37h8l7 53H38zM49 37Q21 31 6 47 8 19 39 23 16 5 18 5q27-1 33 22Q63 3 84 5L66 23q29-5 28 24-17-17-40-10z"/>'],
 ['Roma sütunu','<path d="M16 11h68v11H16zM22 27h56v8H22zM30 39h9v37h-9zm16 0h8v37h-8zm15 0h9v37h-9zM23 79h54v8H23zM16 90h68v7H16z"/>'],
 ['Meşale','<path d="M33 47h34l-8 40H41zM50 43C20 43 29 15 39 6c-1 17 11 9 15-3 26 31 14 40-4 40z"/>'],
 ['Çapraz baltalar','<path d="m22 7 64 77-6 6L16 13zM78 7 14 84l6 6 64-77zM23 20 7 27l14 22 9-17zM77 20l16 7-14 22-9-17z"/>'],
 ['Sekiz köşeli yıldız','<path d="m50 5 10 24 26-15-15 26 24 10-24 10 15 26-26-15-10 24-10-24-26 15 15-26L5 50l24-10-15-26 26 15z"/>'],
 ['Defneli SPQR',laurel+'<text x="50" y="56" text-anchor="middle" font-family="Georgia,serif" font-size="21" font-weight="bold" fill="currentColor">SPQR</text>'],
 ['Dört ok','<path d="M45 22h10v56H45zM22 45h56v10H22zM50 3 34 24h32zM50 97 34 76h32zM3 50l21-16v32zM97 50 76 34v32z"/>'],
 ['Dağ','<path d="M5 84 34 22l17 29L67 9l29 75z"/><path d="m28 36 6-14 8 14-8-3zM57 34 67 9l10 25-10-6z" fill="var(--crest-bg,#791c2a)"/>'],
 ['Çapa','<path d="M46 30h8v45l19-13-6-8 26-7-8 25-7-5-28 24-28-24-7 5-8-25 26 7-6 8 19 13zM27 34h46v7H27z"/><circle cx="50" cy="19" r="12" fill="none" stroke="currentColor" stroke-width="7"/>'],
 ['Zafer eli','<path d="M27 45 24 28l7-4 11 19L32 12l8-4 15 33 2-33 9 1-1 40 14-13 9 6-16 25-12 20H37L19 62 9 49l6-8z"/>'],
 ['Kraliyet tacı','<path d="M12 29 32 44 50 18l18 26 20-15-7 42H19zM20 77h60v11H20z"/><circle cx="12" cy="24" r="6"/><circle cx="50" cy="12" r="6"/><circle cx="88" cy="24" r="6"/>']
];
const colors=['#791c2a','#172b41','#1f493a','#332742','#171b20','#f0e7d2','#af7c3d','#b6bec5','#d8b36d','#ffffff'];
function safeColor(x,f){return /^#[0-9a-f]{6}$/i.test(x||'')?x:f;}
function symbol(id,color='#d8b36d',bg='#791c2a'){const body=rows[Math.max(0,Math.min(29,Number(id)-1))]?.[1]||rows[0][1];return '<svg viewBox="0 0 100 100" aria-hidden="true" style="color:'+safeColor(color,'#d8b36d')+';--crest-bg:'+safeColor(bg,'#791c2a')+'" xmlns="http://www.w3.org/2000/svg"><g fill="currentColor">'+body+'</g></svg>';}
function banner(id,color,bg){color=safeColor(color,'#d8b36d');bg=safeColor(bg,'#791c2a');return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 400" aria-hidden="true"><defs><linearGradient id="cloth" x1="0" x2="1"><stop stop-color="#000" stop-opacity=".26"/><stop offset=".23" stop-color="#fff" stop-opacity=".06"/><stop offset=".51" stop-color="#000" stop-opacity=".1"/><stop offset=".74" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".23"/></linearGradient><clipPath id="flagShape"><path d="M25 20H215V380L120 330 25 380z"/></clipPath></defs><g clip-path="url(#flagShape)"><path fill="'+bg+'" d="M25 20H215V380L120 330 25 380z"/><path fill="url(#cloth)" d="M25 20H215V380H25z"/><path d="M33 28H207V365L120 318 33 365z" fill="none" stroke="'+color+'" stroke-width="2" opacity=".7"/><svg x="53" y="98" width="134" height="134" viewBox="0 0 100 100" style="color:'+color+';--crest-bg:'+bg+'"><g fill="currentColor">'+rows[Math.max(0,Math.min(29,Number(id)-1))][1]+'</g></svg><path d="M77 253h86M92 261h56" stroke="'+color+'" opacity=".65"/></g><rect x="12" y="7" width="216" height="13" rx="5" fill="'+color+'"/><circle cx="12" cy="13" r="7" fill="'+color+'"/><circle cx="228" cy="13" r="7" fill="'+color+'"/></svg>';}
return{rows:rows.map((r,i)=>({id:i+1,name:r[0]})),colors,symbol,banner};
})();
