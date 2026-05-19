import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

// Email validation
export const validateEmail = (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  
  // Normalize email
  req.body.email = validator.normalizeEmail(email) || email;
  next();
};

// Password validation
export const validatePassword = (req: Request, res: Response, next: NextFunction) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  // Password requirements
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
  }
  
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
  }
  
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one number' });
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one special character' });
  }
  
  next();
};

// Sanitize input to prevent XSS
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return validator.escape(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  next();
};

// Validate UUID
export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    
    if (!value || !validator.isUUID(value)) {
      return res.status(400).json({ error: `Invalid ${paramName}` });
    }
    
    next();
  };
};

// Validate date format
export const validateDate = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.query[paramName] as string || req.body[paramName];
    
    if (value && !validator.isISO8601(value)) {
      return res.status(400).json({ error: `Invalid date format for ${paramName}` });
    }
    
    next();
  };
};

// Validate numeric input
export const validateNumeric = (paramName: string, min?: number, max?: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.query[paramName] as string || req.body[paramName];
    
    if (value !== undefined) {
      const num = Number(value);
      
      if (isNaN(num)) {
        return res.status(400).json({ error: `${paramName} must be a number` });
      }
      
      if (min !== undefined && num < min) {
        return res.status(400).json({ error: `${paramName} must be at least ${min}` });
      }
      
      if (max !== undefined && num > max) {
        return res.status(400).json({ error: `${paramName} must be at most ${max}` });
      }
    }
    
    next();
  };
};

// Validate required fields
export const validateRequired = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missing.join(', ')}` 
      });
    }
    
    next();
  };
};

// SQL Injection prevention (for raw queries)
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const checkForSQLInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
        /(--|;|\/\*|\*\/|xp_|sp_)/gi,
        /(\bOR\b.*=.*|1=1|'=')/gi
      ];
      
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    
    if (Array.isArray(value)) {
      return value.some(checkForSQLInjection);
    }
    
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkForSQLInjection);
    }
    
    return false;
  };
  
  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  
  next();
};
