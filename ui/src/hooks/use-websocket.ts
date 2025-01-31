import { useEffect, useRef, useState } from 'react'

interface WebSocketMessage {
  type: string
  payload: any
}

export function useWebSocket(url: string) {
  const ws = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    ws.current = socket

    return () => {
      socket.close()
    }
  }, [url])

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      setError('WebSocket is not connected')
    }
  }

  return {
    isConnected,
    error,
    sendMessage,
  }
} 