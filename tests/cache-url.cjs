const assert=require('node:assert/strict');

// A later cache revision is valid; an absent, malformed or older key is not.
function assertCacheRevision(url,file,minimum,label=file){
 assert.equal(typeof url,'string',label+' has a script URL');
 const parsed=new URL(url,'https://fixture.invalid/');
 assert.equal(parsed.pathname,'/'+file,label+' loads the intended script');
 assert.equal(parsed.searchParams.getAll('v').length,1,label+' has one cache key');
 const match=/^revision(\d+)$/.exec(parsed.searchParams.get('v'));
 assert.ok(match,label+' has a revision cache key');
 assert.ok(Number(match[1])>=minimum,label+' invalidates revisions before '+minimum);
}

module.exports={assertCacheRevision};
