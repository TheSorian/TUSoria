import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';

describe('TLS Fix for Avanza CA', () => {
  const certPath = path.join(process.cwd(), 'certs', 'sectigo-ov-r36.pem');

  it('certificate file exists and is valid PEM', () => {
    expect(fs.existsSync(certPath)).toBe(true);
    const pem = fs.readFileSync(certPath, 'utf8');
    
    // Parse it using crypto to ensure it's a valid X509 certificate
    const cert = new crypto.X509Certificate(pem);
    
    expect(cert.subject).toContain('Sectigo Public Server Authentication CA OV R36');
    expect(cert.issuer).toContain('Sectigo Public Server Authentication Root R46');
  });

  it('certificate has the exact expected SHA-256 fingerprint', () => {
    const pem = fs.readFileSync(certPath, 'utf8');
    const cert = new crypto.X509Certificate(pem);
    
    // Expected fingerprint from crt.sh/?d=4267304698
    const expectedFingerprint = '65:42:D1:76:BE:D5:0F:19:3C:0C:E2:97:AE:44:EC:D8:A0:A8:6B:EC:2E:DE:68:27:69:34:40:59:B4:E7:85:30';
    expect(cert.fingerprint256).toBe(expectedFingerprint);
  });
});
