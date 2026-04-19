import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
});

const FROM = process.env.NOTIFY_FROM || 'ca-guardian@yourdomain.com';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function htmlWrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#4F46E5;padding:16px 24px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:20px">CA Guardian</h1>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
      <h2 style="margin-top:0">${title}</h2>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#6b7280;font-size:12px">CA Guardian — Conditional Access Policy Management Platform</p>
    </div>
  </body></html>`;
}

export async function sendChangeRequestNotification(opts: {
  toEmails: string[];
  requesterName: string;
  policyName: string;
  justification: string;
  requestId: string;
}): Promise<void> {
  const body = `
    <p><strong>${opts.requesterName}</strong> has submitted a change request for the following Conditional Access policy:</p>
    <div style="background:#f9fafb;padding:16px;border-radius:6px;margin:16px 0">
      <strong>Policy:</strong> ${opts.policyName}<br/>
      <strong>Justification:</strong> ${opts.justification}
    </div>
    <p>Please review and approve or reject this request in the CA Guardian portal.</p>
    <a href="${APP_URL}/change-requests/${opts.requestId}" style="background:#4F46E5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Review Request</a>
  `;
  await send(opts.toEmails, 'Action Required: CA Policy Change Request', htmlWrap('Change Request Received', body));
}

export async function sendApprovalNotification(opts: {
  toEmail: string;
  approved: boolean;
  approverName: string;
  policyName: string;
  note?: string;
  requestId: string;
}): Promise<void> {
  const status = opts.approved ? 'Approved ✓' : 'Rejected ✗';
  const color = opts.approved ? '#059669' : '#DC2626';
  const body = `
    <p>Your change request has been <span style="color:${color};font-weight:bold">${status}</span> by <strong>${opts.approverName}</strong>.</p>
    <div style="background:#f9fafb;padding:16px;border-radius:6px;margin:16px 0">
      <strong>Policy:</strong> ${opts.policyName}<br/>
      ${opts.note ? `<strong>Note:</strong> ${opts.note}` : ''}
    </div>
    ${opts.approved ? `<p>The policy has been unlocked. Please apply your changes as soon as possible — it will be automatically re-locked after 2 hours.</p>
    <a href="${APP_URL}/change-requests/${opts.requestId}" style="background:#4F46E5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Request</a>` : ''}
  `;
  await send([opts.toEmail], `CA Policy Change Request ${status}`, htmlWrap(`Request ${status}`, body));
}

export async function sendChangeDetectedNotification(opts: {
  toEmails: string[];
  policyName: string;
  changedBy?: string;
  requestId: string;
}): Promise<void> {
  const body = `
    <p>A change has been detected in the following Conditional Access policy:</p>
    <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:0 6px 6px 0;margin:16px 0">
      <strong>Policy:</strong> ${opts.policyName}<br/>
      ${opts.changedBy ? `<strong>Changed by:</strong> ${opts.changedBy}` : ''}
    </div>
    <p>Please review the changes and approve or initiate a rollback.</p>
    <a href="${APP_URL}/change-requests/${opts.requestId}" style="background:#4F46E5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Review Changes</a>
  `;
  await send(opts.toEmails, '⚠ CA Policy Change Detected — Action Required', htmlWrap('Change Detected', body));
}

export async function sendRollbackNotification(opts: {
  toEmails: string[];
  policyName: string;
  rolledBackBy: string;
  versionNumber: number;
}): Promise<void> {
  const body = `
    <p><strong>${opts.rolledBackBy}</strong> has rolled back the following policy to version <strong>v${opts.versionNumber}</strong>:</p>
    <div style="background:#f9fafb;padding:16px;border-radius:6px;margin:16px 0">
      <strong>Policy:</strong> ${opts.policyName}
    </div>
    <a href="${APP_URL}/policies" style="background:#4F46E5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Policies</a>
  `;
  await send(opts.toEmails, 'CA Policy Rolled Back', htmlWrap('Policy Rollback Completed', body));
}

async function send(to: string[], subject: string, html: string): Promise<void> {
  if (!process.env.SMTP_HOST) {
    logger.warn('Email not configured — skipping notification', { subject, to });
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    logger.info('Email notification sent', { subject, to });
  } catch (err) {
    logger.error('Failed to send email notification', { subject, to, err });
  }
}
