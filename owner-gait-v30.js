/* Analog speed in metres/second: centre deadzone, normal walk, then run. */
var LudusGait=(()=>{
 function sample(magnitude){const m=Math.max(0,Math.min(1,Number(magnitude)||0));if(m<=.10)return {speed:0,factor:0,run:0};const walk=Math.min(1,(m-.10)/.45),run=Math.max(0,Math.min(1,(m-.65)/.35)),smooth=run*run*(3-2*run),speed=1.65*walk+2.55*smooth;return{speed,factor:speed/m,run:smooth};}
 return{sample};
})();
