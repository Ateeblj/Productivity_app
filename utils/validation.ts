export const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email';
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
};

export const validateRequired = (value: string, field: string = 'This field'): string | null => {
  if (!value || !value.trim()) return `${field} is required`;
  return null;
};

export interface AuthFormErrors {
  email: string;
  password: string;
  confirmPassword?: string;
}

export const validateAuthForm = (
  email: string,
  password: string,
  confirmPassword?: string
): AuthFormErrors => {
  return {
    email: validateEmail(email) || '',
    password: validatePassword(password) || '',
    confirmPassword: confirmPassword && password !== confirmPassword ? 'Passwords do not match' : '',
  };
};
