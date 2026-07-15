import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        const zodError = error as { issues: Array<{ message: string }> };
        const messages = zodError.issues.map((issue) => issue.message);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: messages,
        });
      } else {
        next(error);
      }
    }
  };
};
