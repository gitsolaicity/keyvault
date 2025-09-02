'use client'

import { useState, useEffect } from 'react'

type KeyEntry = {
  id: string
  name: string
  login: string
  password: string
}

// Мастер-пароль
const MASTER_KEY = 'supersecret123'

// Хелперы для шифрования
async function encrypt(text: string, password: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derived,
    enc.encode(text)
  )
  // возвращаем base64
  return `${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...salt))}:${btoa(String.fromCharCode(...new Uint8Array(encrypted)))}`
}

async function decrypt(data: string, password: string) {
  const [ivStr, saltStr, encryptedStr] = data.split(':')
  const dec = new TextDecoder()
  const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0))
  const salt = Uint8Array.from(atob(saltStr), c => c.charCodeAt(0))
  const encrypted = Uint8Array.from(atob(encryptedStr), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derived,
    encrypted
  )
  return dec.decode(decrypted)
}

export default function KeyVault() {
  const [entries, setEntries] = useState<KeyEntry[]>([])
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [masterInput, setMasterInput] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)

  const unlock = () => {
    if (masterInput === MASTER_KEY) setAuthenticated(true)
    else alert('Неверный мастер-пароль')
  }

  // Загрузка данных
  useEffect(() => {
    if (!authenticated) return
    const data = localStorage.getItem('keyvault')
    if (!data) return
    decrypt(data, MASTER_KEY)
      .then(res => setEntries(JSON.parse(res)))
      .catch(() => console.error('Ошибка расшифровки'))
  }, [authenticated])

  const saveEntries = async (updated: KeyEntry[]) => {
    setEntries(updated)
    const encrypted = await encrypt(JSON.stringify(updated), MASTER_KEY)
    localStorage.setItem('keyvault', encrypted)
  }

  const addEntry = () => {
    const newEntry = { id: crypto.randomUUID(), name, login, password }
    saveEntries([...entries, newEntry])
    setName(''); setLogin(''); setPassword('')
  }

  const deleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id)
    saveEntries(updated)
  }

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0b0f] text-white">
        <h1 className="text-2xl mb-4">Введите мастер-пароль</h1>
        <input
          type="password"
          value={masterInput}
          onChange={e => setMasterInput(e.target.value)}
          className="p-2 rounded mb-2 bg-[#222] text-white"
          placeholder="Мастер-пароль"
        />
        <button
          onClick={unlock}
          className="bg-[#e0b85c] text-black p-2 rounded hover:bg-[#d4a900]"
        >
          Открыть
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-[#111] rounded-lg text-white">
      <h1 className="text-xl font-bold mb-4">Связка ключей</h1>

      <div className="flex flex-col gap-2 mb-4">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Название"
          className="p-2 rounded bg-[#222]"
        />
        <input
          value={login}
          onChange={e => setLogin(e.target.value)}
          placeholder="Логин"
          className="p-2 rounded bg-[#222]"
        />
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Пароль"
          type="password"
          className="p-2 rounded bg-[#222]"
        />
        <div className="flex gap-2">
          <button
            onClick={addEntry}
            className="bg-[#e0b85c] text-black p-2 rounded hover:bg-[#d4a900]"
          >
            Добавить
          </button>
          <button
            onClick={() => setShowPasswords(!showPasswords)}
            className="bg-[#333] p-2 rounded hover:bg-[#444]"
          >
            {showPasswords ? 'Скрыть пароли' : 'Показать пароли'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {entries.map(e => (
          <div
            key={e.id}
            className="p-3 bg-[#222] rounded flex justify-between items-center"
          >
            <div>
              <div className="font-medium">{e.name}</div>
              <div className="text-sm">{e.login}</div>
              <div className="text-sm">{showPasswords ? e.password : '••••••••'}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(e.password)}
                className="px-2 py-1 bg-[#333] rounded hover:bg-[#444]"
              >
                Копировать
              </button>
              <button
                onClick={() => deleteEntry(e.id)}
                className="px-2 py-1 bg-red-600 rounded hover:bg-red-700"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
