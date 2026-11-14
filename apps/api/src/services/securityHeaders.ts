// P491: Security response header policy
export const requiredSecurityHeaders = (production:boolean) => ({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'",...(production?{'Strict-Transport-Security':'max-age=31536000; includeSubDomains'}:{})});
