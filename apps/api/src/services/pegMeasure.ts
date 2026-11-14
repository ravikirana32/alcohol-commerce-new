// P463: Peg measure conversion controls
export const convertPegMeasureMl = (quantity:number,unit:'ML'|'CL'|'L') => { if(!Number.isFinite(quantity)||quantity<=0) throw new Error('Invalid measure quantity'); const factor={ML:1,CL:10,L:1000}[unit]; const ml=quantity*factor; if(!Number.isSafeInteger(ml)) throw new Error('Measure must resolve to whole millilitres'); return ml; };
