// Prevent a production binary from accidentally exposing reference/mock services.
// Remove individual blockers only in a reviewed change with end-to-end evidence.
// An environment flag or a string claiming completion cannot bypass this gate.
const blockers=Object.freeze([
 'account authentication and account-scoped live save integration',
 'store purchase SDK and verified notification reconciliation',
 'SSV and authoritative reward application',
 'production API and external backup recovery',
 'account deletion and store compliance paths'
]);
function assertProductionReady(){if(blockers.length)throw Error('Production release blocked: '+blockers.join('; '));}
module.exports={blockers,assertProductionReady};
