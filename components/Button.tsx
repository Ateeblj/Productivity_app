import React from 'react';
import { Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import AnimatedPressable from './AnimatedPressable';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle; // Kept for legacy support, but try to use className going forward
  textStyle?: TextStyle;
  className?: string; // Added support for custom Tailwind classes from parent
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  className = '',
}) => {
  // Tailwind mapping for the button background/border
  const getButtonClasses = () => {
    if (disabled) return 'bg-border dark:bg-border-dark';

    switch (variant) {
      case 'primary':
        return 'bg-primary dark:bg-primary-dark';
      case 'secondary':
        return 'bg-transparent border-2 border-primary dark:border-primary-dark';
      case 'danger':
        return 'bg-red-500 dark:bg-red-600';
      case 'ghost':
        return 'bg-transparent';
      default:
        return 'bg-primary dark:bg-primary-dark';
    }
  };

  // Tailwind mapping for the text color
  const getTextClasses = () => {
    if (disabled) return 'text-text-muted dark:text-text-muted-dark';

    switch (variant) {
      case 'secondary':
      case 'ghost':
        return 'text-primary dark:text-primary-dark';
      default:
        return 'text-white';
    }
  };

  // Determine spinner color based on variant
  const getSpinnerColor = () => {
    if (disabled) return '#8A829A'; // text-muted
    return variant === 'secondary' || variant === 'ghost' ? '#6C4E9A' : '#FFFFFF';
  };

  const getShadowClass = () => {
    if (disabled || variant === 'secondary' || variant === 'ghost') return '';
    return 'shadow-card';
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      // Combine base structural classes with dynamic variant classes
      className={`py-3 px-6 rounded-2xl items-center justify-center min-w-[100px] ${getShadowClass()} ${getButtonClasses()} ${className}`}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color={getSpinnerColor()} size="small" />
      ) : (
        <Text
          className={`text-[15px] font-semibold tracking-wide ${getTextClasses()}`}
          style={textStyle}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
};

export default Button;
