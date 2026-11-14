// P490: Large report export page guard
export const validateExportPage = (page:number,pageSize:number,maxPageSize=500) => { if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>maxPageSize)throw new Error('Invalid export page'); return {offset:(page-1)*pageSize,limit:pageSize}; };
