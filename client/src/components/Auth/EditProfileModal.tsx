import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'

interface Props {
  onClose: () => void
}

type Tab = 'profile' | 'password' | 'admin'

export default function EditProfileModal({ onClose }: Props) {
  const { user, updateProfile, changePassword, setBackupEmailPreference } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')

  // Profile tab state
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPasswordProfile, setCurrentPasswordProfile] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  // Password tab state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  // Backup email toggle
  const [backupEnabled, setBackupEnabled] = useState(user?.receiveBackupEmail ?? false)
  const [backupToggleLoading, setBackupToggleLoading] = useState(false)

  async function handleBackupToggle() {
    setBackupToggleLoading(true)
    try {
      await setBackupEmailPreference(!backupEnabled)
      setBackupEnabled(v => !v)
    } finally {
      setBackupToggleLoading(false)
    }
  }

  // Admin tab state
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [resetError, setResetError] = useState('')
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    const nameChanged = name.trim() !== user?.name
    const emailChanged = email.trim() !== user?.email
    if (!nameChanged && !emailChanged) {
      setProfileError('Chưa thay đổi thông tin nào')
      return
    }
    setProfileLoading(true)
    try {
      await updateProfile({
        ...(nameChanged && { name: name.trim() }),
        ...(emailChanged && { email: email.trim() }),
        currentPassword: currentPasswordProfile,
      })
      setProfileSuccess(true)
      setTimeout(onClose, 1000)
    } catch (err: any) {
      setProfileError(err.response?.data?.error ?? 'Lỗi server')
    } finally {
      setProfileLoading(false)
    }
  }

  async function handleSendBackup() {
    setBackupLoading(true)
    setBackupMsg('')
    try {
      const r = await api.post('/admin/send-backup')
      setBackupMsg(r.data.message ?? 'Đã gửi!')
    } catch (err: any) {
      setBackupMsg(err.response?.data?.error ?? 'Lỗi server')
    } finally {
      setBackupLoading(false)
    }
  }

  async function handleReset() {
    setResetLoading(true)
    setResetError('')
    try {
      await api.post('/admin/reset-my-data')
      setResetDone(true)
    } catch (err: any) {
      setResetError(err.response?.data?.error ?? 'Lỗi server')
    } finally {
      setResetLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (newPassword.length < 6) { setPwError('Mật khẩu tối thiểu 6 ký tự'); return }
    if (newPassword !== confirmPassword) { setPwError('Xác nhận mật khẩu không khớp'); return }
    setPwLoading(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setPwSuccess(true)
      setTimeout(onClose, 1200)
    } catch (err: any) {
      setPwError(err.response?.data?.error ?? 'Lỗi server')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Tài khoản</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
          <button
            onClick={() => setTab('profile')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition ${tab === 'profile' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
          >
            Hồ sơ
          </button>
          <button
            onClick={() => setTab('password')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition ${tab === 'password' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
          >
            Đổi mật khẩu
          </button>
          {user?.isAppAdmin && (
            <button
              onClick={() => setTab('admin')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition ${tab === 'admin' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
            >
              Quản trị
            </button>
          )}
        </div>

        {tab === 'profile' && (
          profileSuccess ? (
            <p className="text-center text-emerald-600 py-4">Cập nhật thành công!</p>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại <span className="text-red-400">*</span></label>
                <input type="password" value={currentPasswordProfile} onChange={e => setCurrentPasswordProfile(e.target.value)}
                  placeholder="Xác nhận thay đổi" required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              {profileError && <p className="text-sm text-red-500">{profileError}</p>}

              {/* Backup email toggle */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Nhận backup hàng tuần</p>
                  <p className="text-xs text-gray-400">Gửi qua email mỗi thứ Hai 8:00 SA</p>
                </div>
                <button
                  type="button"
                  onClick={handleBackupToggle}
                  disabled={backupToggleLoading}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${backupEnabled ? 'bg-emerald-500' : 'bg-gray-300'} disabled:opacity-50`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${backupEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">Huỷ</button>
                <button type="submit" disabled={profileLoading || !currentPasswordProfile}
                  className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                  {profileLoading ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          )
        )}

        {tab === 'password' && (
          pwSuccess ? (
            <p className="text-center text-emerald-600 py-4">Đổi mật khẩu thành công!</p>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại" required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự" required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới" required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              {pwError && <p className="text-sm text-red-500">{pwError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">Huỷ</button>
                <button type="submit" disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                  {pwLoading ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          )
        )}
        {tab === 'admin' && (
          resetDone ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-emerald-600 font-medium">Reset hoàn tất!</p>
              <p className="text-sm text-gray-500">Tài khoản sạch, sẵn sàng sử dụng thật.</p>
              <button onClick={onClose} className="mt-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm">Đóng</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-1">
                <p className="text-sm font-medium text-blue-700 mb-1">Gửi backup qua email ngay</p>
                <p className="text-xs text-blue-500 mb-2">File JSON đính kèm gửi tới {user?.email}. Tự động gửi mỗi thứ Hai 8:00 SA.</p>
                {backupMsg && <p className="text-xs text-blue-700 mb-2 font-medium">{backupMsg}</p>}
                <button
                  onClick={handleSendBackup}
                  disabled={backupLoading}
                  className="w-full py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
                >
                  {backupLoading ? 'Đang gửi...' : 'Gửi backup ngay'}
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm font-medium text-red-700 mb-1">Xoá toàn bộ dữ liệu tài chính</p>
                <p className="text-xs text-red-500">Giao dịch, nợ, tiết kiệm, hụi, ngân sách, kế hoạch... sẽ bị xoá vĩnh viễn. Tài khoản vẫn giữ nguyên.</p>
              </div>
              {!resetConfirm ? (
                <button
                  onClick={() => setResetConfirm(true)}
                  className="w-full py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
                >
                  Reset dữ liệu
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-center text-gray-700 font-medium">Chắc chắn muốn xoá?</p>
                  {resetError && <p className="text-xs text-red-500 text-center">{resetError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setResetConfirm(false)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                      Huỷ
                    </button>
                    <button onClick={handleReset} disabled={resetLoading}
                      className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition">
                      {resetLoading ? 'Đang xoá...' : 'Xác nhận xoá'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
