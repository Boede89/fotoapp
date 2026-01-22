import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Kein Token bereitgestellt' });
  }

  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  
  jwt.verify(token, secret, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Ungültiger Token' });
    }
    req.user = user;
    next();
  });
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Unzureichende Berechtigung' });
    }

    next();
  };
}
