import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Dashboard = { patientCount: number; appointmentsToday: number; pendingAppointments: number }
type Patient = { id: string; fullName: string; phoneNumber: string; email?: string }

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard>()
  const [patients, setPatients] = useState<Patient[]>([])
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  const load = async () => {
    const [dashboardResponse, patientsResponse] = await Promise.all([
      fetch(`${apiUrl}/dashboard`), fetch(`${apiUrl}/patients`),
    ])
    if (dashboardResponse.ok) setDashboard(await dashboardResponse.json())
    if (patientsResponse.ok) setPatients(await patientsResponse.json())
  }

  useEffect(() => { void load() }, [])

  const addPatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const response = await fetch(`${apiUrl}/patients`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, phoneNumber, email: null, address: null, dateOfBirth: null, medicalNotes: null }),
    })
    if (response.ok) {
      setFullName('')
      setPhoneNumber('')
      await load()
    }
  }

  return (
    <main className="page">
      <header><p className="eyebrow">BLUE DENTAL</p><h1>Quản lý nha khoa</h1><p>Theo dõi bệnh nhân và lịch hẹn trong một nơi.</p></header>
      <section className="metrics">
        <article><span>Bệnh nhân</span><strong>{dashboard?.patientCount ?? '—'}</strong></article>
        <article><span>Lịch hẹn hôm nay</span><strong>{dashboard?.appointmentsToday ?? '—'}</strong></article>
        <article><span>Chờ xác nhận</span><strong>{dashboard?.pendingAppointments ?? '—'}</strong></article>
      </section>
      <section className="content">
        <div className="panel"><h2>Thêm bệnh nhân</h2><form onSubmit={addPatient}>
          <label>Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <label>Số điện thoại<input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required /></label>
          <button type="submit">Lưu bệnh nhân</button>
        </form></div>
        <div className="panel"><h2>Bệnh nhân gần đây</h2>
          {patients.length === 0 ? <p>Chưa có bệnh nhân nào.</p> : <ul>{patients.slice(0, 6).map((patient) => <li key={patient.id}><b>{patient.fullName}</b><span>{patient.phoneNumber}</span></li>)}</ul>}
        </div>
      </section>
    </main>
  )
}
