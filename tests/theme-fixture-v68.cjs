// Standalone UI fixtures must load the same final theme as their real host page.
const path=require('node:path');
module.exports=async(page,root,screen='ludus')=>{
 await page.evaluate(screen=>{document.body.dataset.romanScreen=screen;document.body.dataset.artDirection="136";},screen);
 await page.addStyleTag({path:path.join(root,'game-art-v136.css')});
 await page.addStyleTag({path:path.join(root,'roman-ui-v56.css')});
 await page.addStyleTag({path:path.join(root,'roman-theme-v68.css')});
 await page.addStyleTag({path:path.join(root,'arena-art-v69.css')});
 await page.addStyleTag({path:path.join(root,'game-panels-v123.css')});
};
