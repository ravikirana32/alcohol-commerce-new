// P451: Canonical release version validation
export const validateReleaseVersion = (version:string, phase:number) => { const m=/^(\d+)\.(\d+)\.(\d+)(?:-dev)?$/.exec(version); if(!m || !Number.isInteger(phase) || phase<1) return false; return Number(m[2])===phase || Number(m[2])===Math.floor(phase/100); };
