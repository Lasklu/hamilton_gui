import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../types/errors';

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Check if it's a custom ApiError
  if ('statusCode' in err && 'errorCode' in err) {
    const apiError = err as ApiError;
    res.status(apiError.statusCode).json({
      error: apiError.errorCode,
      message: apiError.message,
    });
    return;
  }

  // Default to 500 Internal Server Error
  res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
};
