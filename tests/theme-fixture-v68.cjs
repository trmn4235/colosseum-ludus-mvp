// Standalone UI fixtures must load the same final theme as their real host page.
const path=require('node:path');
module.exports=async(page,root,screen='ludus')=>{
 await page.evaluate(screen=>{document.body.dataset.romanScreen=screen;},screen);
 await page.addStyleTag({path:path.join(root,'roman-ui-v56.css')});
 await page.addStyleTag({path:path.join(root,'roman-theme-v68.css')});
 await page.addStyleTag({path:path.join(root,'arena-art-v69.css')});
};
