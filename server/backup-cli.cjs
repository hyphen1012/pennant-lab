const {createOfflineBackup,verifyBackup,restoreToNewDirectory}=require('./backup.cjs');
(async()=>{const [action,source,target,confirmation]=process.argv.slice(2);
 if(action==='backup'&&confirmation==='--writers-stopped')console.log(await createOfflineBackup({dataDir:source,backupDir:target,quiesced:true}));
 else if(action==='verify'&&source&&!target){await verifyBackup(source);console.log('backup verified');}
 else if(action==='restore'&&confirmation==='--new-directory')console.log(await restoreToNewDirectory({backupDir:source,targetDir:target}));
 else throw Error('backup SOURCE TARGET --writers-stopped | verify BACKUP | restore BACKUP NEW_DIR --new-directory');
})().catch(()=>{console.error('Backup operation failed; inspect configuration and integrity without exposing database contents');process.exitCode=1;});
