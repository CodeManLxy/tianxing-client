const {_electron:electron}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {atomic}=require('../src/core.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'txj-ea-install-')),profile=path.join(sandbox,'profile'),terminal=path.join(sandbox,'terminal');
 fs.mkdirSync(path.join(terminal,'MQL5'),{recursive:true});atomic(path.join(profile,'settings.json'),{commonRoot:path.join(sandbox,'Common'),bridgeId:'TEST_ONLY'});
 const packaged=process.argv.includes('--packaged'),options=packaged?{executablePath:path.join(root,'dist/TianXingJian-win32-x64/TianXingJian.exe'),args:['--user-data-dir='+profile]}:{args:[root],env:{...process.env,TXJ_TEST_USER_DATA:profile}};
 const app=await electron.launch(options),errors=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#skill-list button',{state:'attached'});assert.equal(await page.locator('#skill-list button').count(),2);assert(!await page.locator('#ai-execution-switch').isChecked());
  await app.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},terminal);
  await page.locator('[data-page=settings]').click();await page.locator('#install-ea').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已安装'));
  const dest=path.join(terminal,'MQL5/Experts/TianXingBridge'),files=['TianXingBridge.ex5','TianXingBridge.mq5','Json.mqh','SMCRead.mqh'];
  assert.deepEqual(fs.readdirSync(dest).sort(),files.sort());for(const name of files)assert(fs.readFileSync(path.join(dest,name)).equals(fs.readFileSync(path.join(root,'mt5',name))));
  fs.writeFileSync(path.join(dest,'existing-user-file.txt'),'KEEP_TEST_FILE');await page.locator('#notice').evaluate(e=>e.textContent='');await page.locator('#install-ea').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已安装'));
  const backup=fs.readdirSync(path.dirname(dest)).find(name=>name.startsWith('TianXingBridge.backup-'));assert(backup);assert.equal(fs.readFileSync(path.join(path.dirname(dest),backup,'existing-user-file.txt'),'utf8'),'KEEP_TEST_FILE');for(const name of files)assert(fs.readFileSync(path.join(dest,name)).equals(fs.readFileSync(path.join(root,'mt5',name))));
  assert(!fs.existsSync(path.join(terminal,'MQL5/Indicators')));assert(!fs.existsSync(path.join(sandbox,'Common/TXJ_Client/TEST_ONLY/inbox')));assert.deepEqual(errors,[]);
  const report={passed:true,packaged,orders_sent:0,checks:['isolated profile and test MT5 destination','two bundled client skills','AI default off','all four EA files installed byte for byte','existing EA directory backed up','existing user files preserved','no indicator files installed','no trading command created','no renderer errors']};
  atomic(path.join(root,'evidence',packaged?'ea-install-packaged-test.json':'ea-install-source-test.json'),report);console.log((packaged?'Packaged':'Source')+' EA installer passed');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
