import { useState } from 'react'
import type { RecipientLabel } from '../../types'
import api from '../../services/api'

const COLORS = ['#F97316','#EF4444','#EC4899','#A855F7','#3B82F6','#06B6D4','#10B981','#84CC16','#F59E0B','#6B7280']
const ICONS = ['👤','👩','👨','👶','🧒','👧','👦','👴','👵','🧑','👩‍👧','👨‍👩‍👧‍👦','🏠','💼','🎓','❤️']

interface Props {
  labels: RecipientLabel[]
  selected: string | null
  onChange: (id: string | null) => void
  onLabelsChange: (labels: RecipientLabel[]) => void
}

export default function RecipientPicker({ labels, selected, onChange, onLabelsChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('👤')
  const [newColor, setNewColor] = useState('#6B7280')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/recipients', { name: newName.trim(), icon: newIcon, color: newColor })
      const updated = [...labels, res.data]
      onLabelsChange(updated)
      onChange(res.data.id)
      setAdding(false); setNewName(''); setNewIcon('👤'); setNewColor('#6B7280')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-2.5 py-1 rounded-xl text-xs border transition ${!selected ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
        >
          Không chọn
        </button>
        {labels.map(l => (
          <button
            key={l.id}
            type="button"
            onClick={() => onChange(selected === l.id ? null : l.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs border-2 transition font-medium ${selected === l.id ? 'border-current text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            style={selected === l.id ? { backgroundColor: l.color, borderColor: l.color } : {}}
          >
            <span>{l.icon}</span>
            <span>{l.name}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAdding(v => !v)}
          className="px-2.5 py-1 rounded-xl text-xs border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition"
        >
          {adding ? '✕ Hủy' : '+ Thêm nhãn'}
        </button>
      </div>

      {adding && (
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <input
            type="text"
            placeholder="Tên nhãn (Mẹ, Con, Cháu…)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            autoFocus
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <div className="flex gap-2 items-center">
            <div className="flex flex-wrap gap-1">
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setNewIcon(ic)}
                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition ${newIcon === ic ? 'ring-2 ring-emerald-400 bg-emerald-50' : 'hover:bg-gray-100'}`}>
                  {ic}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 ml-auto">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded-full transition ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={saving || !newName.trim()}
            className="w-full bg-emerald-500 text-white text-sm py-2 rounded-lg disabled:opacity-50 font-medium"
          >
            {saving ? 'Đang lưu…' : 'Tạo nhãn'}
          </button>
        </div>
      )}
    </div>
  )
}
