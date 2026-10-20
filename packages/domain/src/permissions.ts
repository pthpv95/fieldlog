import { UserRole } from './schemas/user.js';
import { InspectionStatus } from './schemas/inspection.js';

export interface PermissionContext {
  userRole: UserRole;
  userId: string;
  inspectorId?: string;
  inspectionStatus?: InspectionStatus;
}

export function canCreateInspection(ctx: PermissionContext): boolean {
  return ctx.userRole === 'INSPECTOR' || ctx.userRole === 'SUPERVISOR' || ctx.userRole === 'ADMIN';
}

export function canEditInspection(ctx: PermissionContext): boolean {
  if (ctx.userRole === 'ADMIN') return true;
  if (ctx.userRole === 'SUPERVISOR') return true;
  
  if (ctx.userRole === 'INSPECTOR') {
    if (ctx.inspectorId && ctx.userId !== ctx.inspectorId) {
      return false;
    }
    if (ctx.inspectionStatus && ctx.inspectionStatus !== 'DRAFT' && ctx.inspectionStatus !== 'REOPENED') {
      return false;
    }
    return true;
  }
  
  return false;
}

export function canSubmitInspection(ctx: PermissionContext): boolean {
  return canEditInspection(ctx);
}

export function canReviewInspection(ctx: PermissionContext): boolean {
  return ctx.userRole === 'SUPERVISOR' || ctx.userRole === 'ADMIN';
}

export function canReopenInspection(ctx: PermissionContext): boolean {
  return ctx.userRole === 'SUPERVISOR' || ctx.userRole === 'ADMIN';
}

export function canDeleteInspection(ctx: PermissionContext): boolean {
  return ctx.userRole === 'ADMIN';
}

export function canViewInspection(ctx: PermissionContext): boolean {
  if (ctx.userRole === 'ADMIN' || ctx.userRole === 'SUPERVISOR') return true;
  
  if (ctx.userRole === 'INSPECTOR') {
    if (ctx.inspectorId && ctx.userId === ctx.inspectorId) {
      return true;
    }
    return false;
  }
  
  return false;
}
