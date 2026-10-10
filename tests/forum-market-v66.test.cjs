const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'pazar.html'),'utf8');
const itemCode=html.slice(html.indexOf('var LudusItemSystem ='),html.indexOf("if(typeof module!=='undefined'&&module.exports)module.exports=LudusItemSystem;"));
const context={};vm.createContext(context);vm.runInContext(itemCode,context);global.LudusItemSystem=context.LudusItemSystem;
const rules=require('../forum-market-v66.js');
const gear=(overrides={})=>({kind:'weapon',model:'gladius',enhancement:5,stat_version:10,natural_stats:{physical_power:7,critical_rate:3,critical_damage:5,block_rate:3,block_power:5,armor_penetration:3},natural_percentages:{physical_power:70},emeralds:[{id:5,value:70}],rubies:[],...overrides});
const listing=(id,price,changes={})=>({id,price,asset:gear(changes),seller:'Aquila Ludus',created_at:'2026-10-10T12:00:00Z'});
test('commission and net income agree with server rounding at price boundaries',()=>{
 for(const [p,fee,net]of [[1,1,0],[19,1,18],[20,1,19],[21,2,19],[1001,51,950],[1000000000,50000000,950000000]])assert.deepEqual(rules.priceInfo(p),{price:p,commission:fee,net});
 for(const p of ['',0,-1,1.5,'not a price',1000000001,Infinity])assert.equal(rules.priceInfo(p),null);
});
test('category, Turkish search, model, stone and price filters work together',()=>{
 const rows=[listing('a',1000),listing('b',900,{enhancement:2}),listing('c',500,{model:'spear',natural_percentages:{},emeralds:[]}),listing('d',300,{kind:'shield',model:'large'})];
 assert.deepEqual(rules.filterListings(rows,{kind:'weapon',model:'gladius',plus:'3',stone:'sapphire',max:'1200',query:'AQUİLA',sort:'price'}).map(r=>r.id),['a']);
 assert.deepEqual(rules.filterListings(rows,{kind:'weapon',sort:'price'}).map(r=>r.id),['c','b','a']);
 assert.deepEqual(rules.filterListings(rows,{kind:'weapon',sort:'enhancement'}).map(r=>r.id),['c','a','b']);
 assert.deepEqual(rules.filterListings(rows,{query:'mızrak'}).map(r=>r.id),['c']);
});
test('comparison respects the exact enhancement and real stone similarities',()=>{
 const source=gear(),near=gear({natural_percentages:{physical_power:85}}),far=gear({natural_percentages:{physical_power:10}}),otherStone=gear({emeralds:[{id:3,value:70}]});
 assert.equal(rules.gemMatch(source,near,'close'),true);assert.equal(rules.gemMatch(source,near,'exact'),false);assert.equal(rules.gemMatch(source,far,'close'),false);assert.equal(rules.gemMatch(source,otherStone,'close'),false);assert.equal(rules.gemMatch(source,otherStone,'any'),true);
 const rows=[listing('a',1000),listing('b',900,{enhancement:4}),listing('c',800,{natural_percentages:{physical_power:85}}),listing('d',700,{model:'spear'})];
 assert.deepEqual(rules.comparables(rows,source,{plus:'5',stone:'close'}).map(r=>r.id),['c','a']);
});
test('display uses the current shared stat rules and does not invent gemstone effects',()=>{
 const a=gear(),g=rules.gems(a);assert.equal(g.sapphire[0].label,'Fiziksel Güç');assert.equal(g.sapphire[0].effect,'+%70');assert.equal(g.emerald[0].label,'Fortitudo');assert.equal(g.emerald[0].effect,'+4,9');assert.equal(g.ruby.length,0);
 const effective=LudusItemSystem.effectiveStats(a);assert.ok(Math.abs(effective.physical_power-(7*1.5*1.7+4.9))<1e-9);
});
test('user content is escaped before it enters listing markup',()=>{
 assert.equal(rules.escape('<img src=x onerror="x">'),'&lt;img src=x onerror=&quot;x&quot;&gt;');
 assert.equal(rules.title(gear({name:'Aquila'})),'Aquila +5');assert.equal(rules.title({name:'Marcus',class:'murmillo',level:7}),'Marcus · Sv. 7');
});
test('static integration keeps the original Basic, food and return navigation controls',()=>{
 for(const id of ['basicMarket','marketSections','products','foodMealNote','categories','previousProducts','nextProducts','forumBrowse','forumCreate','forumListings','forumAssetPicker','forumPrice','forumBuy','forumMine','forumDialogs'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.indexOf('src="market-v56.js')<html.indexOf('src="forum-market-v66.js'));assert.ok(html.includes('data-game-back'));assert.ok(html.includes('Forum<br>Pazarı'));
});
