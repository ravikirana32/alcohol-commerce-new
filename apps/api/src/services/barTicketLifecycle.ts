// P461: Bar ticket lifecycle transitions
export const canTransitionBarTicket = (from:string,to:string) => { const map:Record<string,string[]>={OPEN:['SENT','CANCELLED'],SENT:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['READY','CANCELLED'],READY:['SERVED'],SERVED:['CLOSED'],CLOSED:[],CANCELLED:[]}; return (map[from]??[]).includes(to); };
