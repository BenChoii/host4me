"use client"

import { Bot } from 'lucide-react'

export default function AlfredIcon({ size = 64, style = {} }: { size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.25,
      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>
      <Bot size={size * 0.5} color="white" />
    </div>
  )
}
