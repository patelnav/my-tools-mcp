import { useEffect, useRef, useState, useCallback } from 'react'

interface WebSocketMessage {
  type: string
  payload: any
}

export function useWebSocket(url: string) {
  const ws = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messageHandlers = useRef<((message: WebSocketMessage) => void)[]>([])

  const addMessageHandler = useCallback((handler: (message: WebSocketMessage) => void) => {
    messageHandlers.current.push(handler)
    return () => {
      messageHandlers.current = messageHandlers.current.filter(h => h !== handler)
    }
  }, [])

  useEffect(() => {
    const socket = new WebSocket(url)

    socket.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    socket.onclose = () => {
      setIsConnected(false)
    }

    socket.onerror = (event) => {
      setError('WebSocket error occurred')
      console.error('WebSocket error:', event)
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        messageHandlers.current.forEach(handler => handler(message))
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.current = socket

    return () => {
      socket.close()
    }
  }, [url])

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      setError('WebSocket is not connected')
    }
  }, [])

  return {
    isConnected,
    error,
    sendMessage,
    addMessageHandler,
  }
} 