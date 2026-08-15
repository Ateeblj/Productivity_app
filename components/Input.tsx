import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  secureToggle?: boolean;
  containerStyle?: object; // Kept for legacy support
  className?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  secureToggle = false,
  containerStyle,
  className = '',
  secureTextEntry,
  ...rest
}) => {
  const { isDark } = useTheme(); // Kept strictly for placeholder text color compatibility
  const [isSecure, setIsSecure] = useState(secureTextEntry ?? false);
  const [isFocused, setIsFocused] = useState(false);

  // Dynamic border styling based on state
  const getBorderClass = () => {
    if (error) return 'border-red-500 dark:border-red-500';
    if (isFocused) return 'border-primary dark:border-primary-dark';
    return 'border-border dark:border-border-dark';
  };

  return (
    <View style={containerStyle} className={`mb-4 ${className}`}>
      {/* Label */}
      {label && (
        <Text className="text-[13px] font-semibold mb-1.5 tracking-wide text-text-secondary dark:text-text-secondary-dark">
          {label}
        </Text>
      )}

      {/* Input Row */}
      <View
        className={`flex-row items-center border-[1.5px] rounded-xl px-3.5 bg-surface dark:bg-surface-dark ${getBorderClass()}`}
      >
        <TextInput
          {...rest}
          secureTextEntry={isSecure}
          placeholderTextColor={isDark ? '#706880' : '#8A829A'} // text-muted-dark / text-muted
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="flex-1 py-[13px] text-[15px] text-text dark:text-text-dark"
        />

        {/* Toggle Button */}
        {secureToggle && (
          <TouchableOpacity onPress={() => setIsSecure(!isSecure)} className="pl-2.5 py-2">
            <Text className="text-primary dark:text-primary-dark text-[13px] font-medium">
              {isSecure ? 'Show' : 'Hide'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <Text className="text-red-500 dark:text-red-400 text-xs mt-1.5 ml-1">
          {error}
        </Text>
      )}
    </View>
  );
};

export default Input;
