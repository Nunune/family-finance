import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-6 text-center">
        <div className="text-6xl mb-4">🔋</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          Ví tiền đang &ldquo;sạc pin&rdquo;
        </h1>
        <p className="text-gray-500 text-sm mb-6">xíu bạn quay lại nhé!</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 transition active:scale-95"
        >
          Thử lại
        </button>
      </div>
    )
  }
}
