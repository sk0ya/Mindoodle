

export const isDevelopment = (): boolean => {
  
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.DEV || import.meta.env.MODE === 'development';
  }
  
  
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }
  
  
  return false;
};

export const isProduction = (): boolean => {
  
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.PROD || import.meta.env.MODE === 'production';
  }
  
  
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'production';
  }
  
  
  return true;
};

export const getMode = (): string => {
  
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.MODE || 'production';
  }
  
  
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV || 'production';
  }
  
  return 'production';
};