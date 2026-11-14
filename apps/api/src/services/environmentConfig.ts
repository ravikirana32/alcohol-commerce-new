// P452: Environment configuration validation
export const validateEnvironmentConfig = (env:Record<string,string|undefined>) => { const required=['DATABASE_URL','JWT_SECRET','WEB_ORIGIN']; const missing=required.filter(k=>!env[k]?.trim()); const secret=env.JWT_SECRET??''; return {ready:missing.length===0 && secret.length>=32,missing,weakSecret:secret.length>0 && secret.length<32}; };
