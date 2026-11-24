import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const url='http://127.0.0.1:4173/research/fv07/lab.html';
const server=spawn('npm',['run','dev','--','--strictPort'],{stdio:'inherit'});
let browser;
try{
 for(let i=0;i<80;i++){
  try{if((await fetch(url)).ok)break;}catch{}
  if(i===79)throw Error('Vite did not start');
  await new Promise(r=>setTimeout(r,250));
 }
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({acceptDownloads:true});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
 await page.goto(url);
 await page.locator('#fixture').click();
 await page.locator('#calibrate').click();
 await page.waitForFunction(()=>document.querySelector('#calibration').textContent.includes('holdoutCount'));
 const report=JSON.parse(await page.locator('#calibration').textContent());
 assert.equal(report.holdoutCount,5);
 assert.equal(report.fitCount,7);
 assert.equal(report.neutralReferenceCount,3);
 assert.equal(report.skinMeasurementEligible,false);
 for(const name of ['raw','neutral','ramp','affine']){
  assert.equal(report[name].n,5);
  assert.ok(report[name].meanAbsA<2);
 }
 await page.locator('#repeat').click();
 const result=JSON.parse(await page.locator('#results').textContent());
 assert.equal(result.status,'abstain');
 const downloadPromise=page.waitForEvent('download');
 await page.locator('#export').click();
 const download=await downloadPromise;
 const data=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(data.skinMeasurementEligible,false);
 assert.equal(data.calibrated,false);
 assert.equal(data.reference.holdoutCount,5);
 assert.deepEqual(data.observations,[]);
 assert.ok(!JSON.stringify(data).includes('data:image'));
 await page.locator('#clear').click();
 assert.equal(await page.locator('#calibration').textContent(),'');
 assert.deepEqual(errors,[]);
 assert.deepEqual(external,[]);
 console.log('CHROMA browser smoke: synthetic target, 4 correction methods, abstention, numeric export, session clearing, and local-only requests passed.');
}finally{
 if(browser)await browser.close();
 server.kill();
}
