export type AuthPrincipal = {
  userId: string;
  email: string;
  displayName: string;
  isPlatformAdmin: boolean;
  organisationId: string | null;
  roleCode: string | null;
  sessionId: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
    }
  }
}
