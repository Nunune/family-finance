import { useState } from 'react'

interface Props {
  code: string
  onDone: () => void
}

export default function RecoveryCodeModal({ code, onDone }: Props) {
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">🔑</div>
          <h2 className="text-xl font-bold text-gray-800">Lưu mã khôi phục</h2>
          <p className="text-sm text-gray-500 mt-1">
            Dùng mã này để đặt lại mật khẩu nếu bạn quên. Mã chỉ hiển thị <strong>một lần duy nhất</strong>.
          </p>
        </div>

        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center mb-4">
          <span className="text-2xl font-mono font-bold tracking-widest text-gray-800 select-all">
            {code}
          </span>
        </div>

        <button onClick={copy} className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition mb-3">
          {copied ? '✓ Đã sao chép' : 'Sao chép mã'}
        </button>

        <div className="bg-amber-50 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700">
            ⚠️ Ghi mã này ra giấy hoặc lưu vào nơi an toàn. Không ai có thể xem lại mã này sau khi bạn đóng trang.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-emerald-500 flex-shrink-0"
          />
          <span className="text-sm text-gray-600">Tôi đã lưu mã khôi phục ở nơi an toàn</span>
        </label>

        <button
          onClick={onDone}
          disabled={!confirmed}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition disabled:opacity-40"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  )
}
