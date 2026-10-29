/* Reuse the market equipment artwork; no additional model downloads. */
var LudusSupplyIcons=(function(){
var LUDUS_EQUIPMENT_ATLAS="assets/textures/shared-ui-91a94259c0b5.webp";
var LUDUS_HELMET_ICONS={"gladiator":"assets/items-v194/helmet-gold.webp","knights":"assets/items-v194/helmet-silver.webp","winged":"assets/items-v194/helmet-winged.webp","roman":"assets/items-v194/helmet-roman.webp","viking_helmet":"assets/items-v189/helmet-viking.webp","steel_helmet":"assets/items-v189/helmet-steel.webp","sylvain_helmet":"assets/items-v169/helmet-sylvain.webp"};
var LUDUS_ARMOUR_ICONS={"gladiator_chest":"assets/textures/shared-ui-89bcf1e90f16.webp","chest_plate":"assets/textures/shared-ui-730d42485f3a.webp","armor_shoulder":"assets/textures/shared-ui-265d36601366.webp","shoulder_armor":"assets/textures/shared-ui-3c831205a71f.webp"};

 let iconSequence=0;
 const cells={gladius:0,sica:1,spear:2,trident:3,net:4,mace:5,whip:6,scissor:7};
 const bounds=[[8,6,299,301],[329,5,293,298],[629,5,299,302],[953,7,292,301],[7,337,295,242],[329,313,281,279],[650,351,281,241],[956,319,289,278],[44,607,236,292],[339,614,269,288],null,null,[16,910,265,323],[319,926,296,300],[660,916,278,313],[945,942,292,270]];
 function helmetKey(value){if(['viking_helmet','steel_helmet','sylvain_helmet'].includes(value))return value;return value==='roman'||value==='roman_helmet'?'roman':value==='silver'||value==='knights'||value==='knights_helm'?'knights':value==='winged'||value==='winged_helmet_gameready'?'winged':'gladiator';}
 function index(it){if(!it)return -1;if(it.kind==='weapon')return cells[it.model]??0;if(it.kind==='shield')return it.model==='large'?8:9;if(it.kind==='helmet')return helmetKey(it.model)==='knights'?11:10;return {chest:12,gloves:13,legs:14,pouch:15}[it.kind]??-1;}
 function svg(it){const art=globalThis.LudusProduction?.artwork(it)||globalThis.LudusItemVisuals?.artwork(it);if(art)return art;return globalThis.LudusItemVisuals?.placeholder(it)||'<svg class="equipment-icon" viewBox="0 0 96 96" role="img" aria-label="Eşya görseli yüklenemedi"><circle cx="48" cy="48" r="30" fill="none" stroke="#b8aa91"/></svg>';}
 return {svg,index,bounds,helmetKey};
})();
