const {createOfflineBackup,verifyBackup,restoreToNewDirectory}=require('./backup.cjs');
(async()=>{const [action,source,target,confirmation,latestDeletionFile]=process.argv.slice(2);
 if(action==='backup'&&confirmation==='--writers-stopped')console.log(await createOfflineBackup({dataDir:source,backupDir:target,quiesced:true}));
 else if(action==='verify'&&source&&!target){await verifyBackup(source);console.log('backup verified');}
 else if(action==='restore'&&confirmation==='--writers-stopped'&&latestDeletionFile)console.log(await restoreToNewDirectory({backupDir:source,targetDir:target,latestDeletionFile,quiesced:true}));
 else throw Error('backup SOURCE TARGET --writers-stopped | verify BACKUP | restore BACKUP NEW_DIR --writers-stopped LATEST_DELETION_SQLITE');
})().catch(()=>{console.error('Backup operation failed; inspect configuration and integrity without exposing database contents');process.exitCode=1;});
