import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT=resolve(import.meta.dirname,'..')
const PACKAGES=join(ROOT,'packages')
const PUBLIC=new Set(['@orven/core','@orven/plugin-dsh'])
const VERSION='0.1.0'
const fail=m=>{throw new Error('distribution: '+m)}
const run=(cmd,args,cwd=ROOT)=>new Promise((res,rej)=>{
  const p=spawn(cmd,args,{cwd,env:process.env,stdio:['ignore','pipe','pipe']});let out='',err=''
  p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8')
  p.stdout.on('data',x=>out+=String(x));p.stderr.on('data',x=>err+=String(x))
  p.on('error',rej);p.on('close',code=>code===0?res({stdout:out,stderr:err}):rej(new Error(cmd+' failed '+code+'\n'+out+'\n'+err)))
})
const dirs=(await readdir(PACKAGES,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort()
const manifests=[]
for(const dir of dirs){
  const path=join(PACKAGES,dir,'package.json')
  let manifest
  try{manifest=JSON.parse(await readFile(path,'utf8'))}catch{continue}
  manifests.push({dir,manifest})
}
for(const {manifest} of manifests){
  if(PUBLIC.has(manifest.name)){
    if(manifest.private===true) fail(manifest.name+' must be public')
    if(manifest.version!==VERSION) fail(manifest.name+' must be '+VERSION)
  }else if(manifest.name?.startsWith('@orven/')){
    if(manifest.private!==true) fail(manifest.name+' must stay private')
    if(!manifest.name.startsWith('@orven/internal-')) fail('private package must use @orven/internal-* naming: '+manifest.name)
  }
}
const publicPkgs=manifests.filter(x=>PUBLIC.has(x.manifest.name))
if(publicPkgs.length!==2) fail('expected exactly two public packages, found '+publicPkgs.length)
const temp=await mkdtemp(join(tmpdir(),'orven-dist-'))
const tarballs={}
try{
  for(const {dir,manifest} of publicPkgs){
    const before=new Set(await readdir(temp))
    await run('pnpm',['pack','--pack-destination',temp],join(PACKAGES,dir))
    const file=(await readdir(temp)).find(x=>x.endsWith('.tgz')&&!before.has(x))
    if(!file) fail('no tarball for '+manifest.name)
    tarballs[manifest.name]=join(temp,file)
    const packed=JSON.parse((await run('tar',['-xOzf',tarballs[manifest.name],'package/package.json'])).stdout)
    const packedText=JSON.stringify(packed)
    if(packedText.includes('workspace:')) fail(packed.name+' leaked workspace protocol')
    if(packedText.includes('@dsh-factory/')) fail(packed.name+' leaked legacy scope')
    const runtime=JSON.stringify({dependencies:packed.dependencies,peerDependencies:packed.peerDependencies,optionalDependencies:packed.optionalDependencies})
    if(runtime.includes('@orven/internal-')) fail(packed.name+' depends on private packages')
    const list=(await run('tar',['-tzf',tarballs[manifest.name]])).stdout
    const leaked=list.split('\\n').filter(file=>/package\\/(src|tests)\\//.test(file)||file.endsWith('/tsconfig.json')||file.includes('.tsbuildinfo')||file.includes('.test.')||file.includes('.spec.'))\n    if(leaked.length>0) fail(packed.name+' leaked development files: '+leaked.join(', '))
    if(!list.includes('package/dist/index.js')||!list.includes('package/dist/index.d.ts')) fail(packed.name+' missing compiled entry')
    if(packed.name==='@orven/core'){
      if(runtime.includes('@deepseek-ai/')||runtime.toLowerCase().includes('cordis')) fail('core leaked Harness dependencies')
      const files=list.split('\n').filter(x=>x.endsWith('.js')||x.endsWith('.d.ts'))
      for(const filePath of files){
        const body=(await run('tar',['-xOzf',tarballs[manifest.name],filePath])).stdout
        if(body.includes('@orven/internal-')||body.includes('@dsh-factory/')||body.includes('@deepseek-ai/')||body.includes('cordis')) fail('core artifact leaked private/Harness import in '+filePath)
      }
    }else{
      if(packed.dependencies?.['@orven/core']===undefined) fail('plugin-dsh must depend on @orven/core')
      if(!list.includes('package/cordis.patch.yml')) fail('plugin-dsh missing cordis.patch.yml')
    }
  }

  const clean=join(temp,'consumer')
  await import('node:fs/promises').then(fs=>fs.mkdir(clean))
  await writeFile(join(clean,'package.json'),JSON.stringify({
    name:'orven-consumer',private:true,type:'module',
    dependencies:{
      '@orven/core':'file:'+tarballs['@orven/core'],
      '@orven/plugin-dsh':'file:'+tarballs['@orven/plugin-dsh']
    }
  },null,2))
  await run('pnpm',['install','--ignore-scripts','--no-frozen-lockfile'],clean)
  await run(process.execPath,['--input-type=module','-e',"await import('@orven/core'); await import('@orven/core/events'); await import('@orven/core/context'); await import('@orven/core/execution'); await import('@orven/plugin-dsh');"],clean)
}finally{await rm(temp,{recursive:true,force:true})}
process.stdout.write('distribution: verified @orven/core and @orven/plugin-dsh '+VERSION+'\n')
