import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  onClose: () => void
}

type Tab = 'profile' | 'password'

export default function EditProfileModal({ onClose }: Props) {
  const { user, updateProfile, changePassword } = useAuth()
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
      </div>
    </div>
  )
}
