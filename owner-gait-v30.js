/* Analog walking in metres/second, including a brisk walk compatible with the tunic. */
var LudusGait=(()=>{
 function sample(magnitude){const m=Math.max(0,Math.min(1,Number(magnitude)||0));if(m<=.10)return {speed:0,factor:0,run:0};const walk=Math.min(1,(m-.10)/.45),fast=Math.max(0,Math.min(1,(m-.65)/.35)),smooth=fast*fast*(3-2*fast),speed=1.65*walk+.95*smooth;return{speed,factor:speed/m,run:0,brisk:smooth};}
 return{sample};
})();
