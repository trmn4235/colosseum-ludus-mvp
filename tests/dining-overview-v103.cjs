// The reserve estimate must not turn wine or quality-only oil into full meals.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dining-food-v55.js'),'utf8'),context);
const days=context.LudusFood.reserveDays;
const data=(crew,items)=>({crew_count:crew,menu:{daily_need:crew*100},items:items.map(([sku,quantity,nutrition])=>({sku,quantity,nutrition}))});
assert.equal(days(data(7,[['grain',70,20]])),2);
assert.equal(days(data(0,[['grain',70,20]])),null);
assert.equal(days(data(7,[])),0);
assert.equal(days(data(7,[['olive_oil',50000,0]])),0);
assert.equal(days(data(7,[['beer',50000,5]])),0);
assert.equal(days(data(1,[['grain',10,20],['beer',10000,5]])),200/95);
assert.equal(days(data(2,[['grain',4,20]])),0.4);
assert.equal(days(data(7,[['grain',28,20],['apple',14,15],['fish',7,25],['meat',7,30],['beer',21,5],['egg',7,20]])),1295/665);
assert.equal(days(data(1,[['bread',10,15]])),1.5,'retired edible stock still counts');
console.log('9 pantry reserve checks passed');
