const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
function load(rel) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module);`, { module });
  return module.exports;
}
const modules = [
['apps/web/src/pos/retailCartRules.ts','validateRetailCart'],['apps/web/src/pos/barcodeRules.ts','normaliseBarcode'],
['apps/api/src/services/tenderAllocation.ts','allocateTenders'],['apps/api/src/services/receiptSafety.ts','receiptText'],
['apps/api/src/services/returnWorkflow.ts','validateReturn'],['apps/api/src/services/barOrderWorkflow.ts','transitionBarOrder'],
['apps/api/src/services/pegMeasurePolicy.ts','pegConsumption'],['apps/api/src/services/stockLossApproval.ts','requireStockLossApproval'],
['apps/api/src/services/splitBillAllocation.ts','splitBill'],['apps/api/src/services/shiftClosePolicy.ts','reconcileShift'],
['apps/api/src/services/purchaseOrderPolicy.ts','transitionPurchaseOrder'],['apps/api/src/services/supplierInvoicePolicy.ts','validateSupplierInvoice'],
['apps/api/src/services/stockTransferPolicy.ts','validateTransfer'],['apps/api/src/services/batchExpiryPolicy.ts','validateBatch'],
['apps/api/src/services/inventoryValuation.ts','valueInventory'],['apps/api/src/services/chartOfAccounts.ts','validateAccount'],
['apps/api/src/services/taxCalculation.ts','calculateTax'],['apps/api/src/services/openBalances.ts','applySettlement'],
['apps/api/src/integrations/accountingExport.ts','validateJournalExport'],['apps/api/src/services/periodClosePolicy.ts','canClosePeriod'],
['apps/api/src/services/platformAdminPolicy.ts','assertPlatformAction'],['apps/api/src/services/campaignEligibility.ts','campaignEligible'],
['apps/api/src/services/distributorFulfilmentPolicy.ts','validateFulfilment'],['apps/api/src/services/tradeIncentiveAccrual.ts','calculateIncentive'],
['apps/api/src/services/outletAggregation.ts','aggregateOutlets'],['apps/web/src/offline/queueOrdering.ts','orderOfflineEvents'],
['apps/api/src/services/offlineEnvelope.ts','validateSyncEnvelope'],['apps/api/src/services/offlineResolution.ts','resolveOfflineConflict'],
['apps/api/src/services/deviceRegistration.ts','validateDeviceRegistration'],['apps/api/src/services/notificationPolicy.ts','shouldNotify'],
['apps/api/src/integrations/paymentAdapter.ts','validatePaymentCallback'],['apps/api/src/integrations/hardwareCapabilities.ts','requireHardwareCapability'],
['apps/api/src/services/salesMetrics.ts','salesMetrics'],['apps/api/src/services/partnerMetrics.ts','partnerMetrics'],
['apps/api/src/services/reportExport.ts','csvCell'],['apps/api/src/services/licenceActivityPolicy.ts','mayOperate'],
['apps/api/src/services/exciseRecord.ts','validateExciseRecord'],['apps/api/src/services/securityPolicy.ts','validateSecurityPosture'],
['apps/api/src/services/securityFindings.ts','securityReleaseGate'],['apps/api/src/services/retentionPolicy.ts','retentionAction'],
['apps/api/src/services/testEvidence.ts','evaluateTestEvidence'],['apps/api/src/services/journeyCoverage.ts','criticalJourneyCoverage'],
['apps/api/src/services/loadTestGate.ts','evaluateLoadRun'],['apps/api/src/services/backupEvidence.ts','backupRestoreGate'],
['apps/api/src/services/deploymentGate.ts','deploymentGate'],['apps/api/src/services/stagingData.ts','validateStagingData'],
['apps/api/src/services/pilotEligibility.ts','pilotEligible'],['apps/api/src/services/dailyReconciliation.ts','dailyReconciliation'],
['apps/api/src/services/pilotClosure.ts','pilotClosure'],['apps/api/src/services/generalAvailabilityGate.ts','generalAvailabilityGate']
];
for (const [file, fn] of modules) assert.equal(typeof load(file)[fn], 'function', `${file} must export ${fn}`);
const calls = [
 () => assert.equal(load(modules[0][0]).validateRetailCart([{productId:'p1',quantity:2,unitPriceMinor:100}]),200),
 () => assert.equal(load(modules[1][0]).normaliseBarcode(' 1234-5678-9012 '),'123456789012'),
 () => assert.deepEqual(JSON.parse(JSON.stringify(load(modules[2][0]).allocateTenders(100,[{method:'CASH',amountMinor:100}]))),{totalMinor:100,paidMinor:100,changeMinor:0}),
 () => assert.equal(load(modules[5][0]).transitionBarOrder('OPEN','SENT'),'SENT'),
 () => assert.equal(load(modules[6][0]).pegConsumption(30,2,100),40),
 () => assert.equal(load(modules[16][0]).calculateTax(1000,10).totalMinor,1100),
 () => assert.equal(load(modules[17][0]).applySettlement(100,40).remainingMinor,60),
 () => assert.equal(load(modules[23][0]).calculateIncentive(10,5,40),40),
 () => assert.equal(load(modules[35][0]).mayOperate({review:'VERIFIED',validFrom:'2026-01-01',validUntil:'2026-12-31',activity:'RETAIL_SALE',permittedActivities:['RETAIL_SALE'],at:'2026-06-01'}),true),
 () => assert.equal(load(modules[49][0]).generalAvailabilityGate({functionalAcceptancePercent:100,criticalJourneysPercent:100,openCriticalVulnerabilities:0,openHighVulnerabilities:0,migrationsVerified:true,restoreDrillPassed:true,legalApproval:true,pilotAccepted:true,operationsSignedOff:true}).approved,true)
];
for (const run of calls) run();
console.log(`P351-P400 module load checks: ${modules.length}/${modules.length} passed`);
console.log(`P351-P400 runtime invariant smoke checks: ${calls.length}/${calls.length} passed`);
