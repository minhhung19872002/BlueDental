import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Dashboard = { patientCount: number; appointmentsToday: number; pendingAppointments: number; revenueToday: number }
type Patient = { id: string; fullName: string; phoneNumber: string; email?: string; address?: string; medicalNotes?: string }
type Dentist = { id: string; fullName: string; specialty: string; phoneNumber?: string }
type Appointment = { id: string; startAtUtc: string; reason: string; status: string; patient?: Patient; dentist?: Dentist }
type TreatmentRecord = { id: string; performedAtUtc: string; toothNumber?: string; diagnosis: string; procedureName: string; cost: number; patient?: Patient; dentist?: Dentist }
type Payment = { id: string; amount: number; method: number; paidAtUtc: string; patient?: Patient }

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard>()
  const [patients, setPatients] = useState<Patient[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientAddress, setPatientAddress] = useState('')
  const [patientNotes, setPatientNotes] = useState('')
  const [editingPatientId, setEditingPatientId] = useState<string>()
  const [selectedPatientId, setSelectedPatientId] = useState<string>()
  const [patientSearch, setPatientSearch] = useState('')
  const [dentistName, setDentistName] = useState('')
  const [specialty, setSpecialty] = useState('Tổng quát')
  const [appointment, setAppointment] = useState({ patientId: '', dentistId: '', startAtUtc: '', reason: '' })
  const [treatment, setTreatment] = useState({ patientId: '', dentistId: '', toothNumber: '', diagnosis: '', procedureName: '', cost: '' })
  const [payment, setPayment] = useState({ patientId: '', amount: '', method: '0' })
  const [message, setMessage] = useState('')

  const load = async () => {
    const responses = await Promise.all(['dashboard', 'patients', 'dentists', 'appointments', 'treatment-records', 'payments'].map((path) => fetch(`${apiUrl}/${path}`)))
    if (responses.every((response) => response.ok)) {
      const [dashboardData, patientData, dentistData, appointmentData, treatmentData, paymentData] = await Promise.all(responses.map((response) => response.json()))
      setDashboard(dashboardData); setPatients(patientData); setDentists(dentistData); setAppointments(appointmentData); setTreatments(treatmentData); setPayments(paymentData)
    }
  }

  useEffect(() => { void load() }, [])

  const submit = async (path: string, body: object) => {
    const response = await fetch(`${apiUrl}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(await response.text())
    await load()
  }

  const addPatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const body = { fullName: patientName, phoneNumber: patientPhone, email: patientEmail || null, address: patientAddress || null, dateOfBirth: null, medicalNotes: patientNotes || null }
      if (editingPatientId) {
        const response = await fetch(`${apiUrl}/patients/${editingPatientId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!response.ok) throw new Error()
        await load()
      } else {
        await submit('patients', body)
      }
      setPatientName(''); setPatientPhone(''); setPatientEmail(''); setPatientAddress(''); setPatientNotes(''); setEditingPatientId(undefined); setMessage('Đã lưu bệnh nhân.')
    } catch { setMessage('Không thể lưu bệnh nhân.') }
  }

  const editPatient = (patient: Patient) => {
    setEditingPatientId(patient.id); setPatientName(patient.fullName); setPatientPhone(patient.phoneNumber)
    setPatientEmail(patient.email ?? ''); setPatientAddress(patient.address ?? ''); setPatientNotes(patient.medicalNotes ?? '')
  }

  const matchingPatients = patients.filter((patient) => `${patient.fullName} ${patient.phoneNumber}`.toLocaleLowerCase().includes(patientSearch.toLocaleLowerCase()))
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId)
  const patientAppointments = appointments.filter((item) => item.patient?.id === selectedPatientId)
  const patientTreatments = treatments.filter((item) => item.patient?.id === selectedPatientId)
  const patientPayments = payments.filter((item) => item.patient?.id === selectedPatientId)
  const patientTotalPaid = patientPayments.reduce((total, item) => total + item.amount, 0)

  const addDentist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await submit('dentists', { fullName: dentistName, specialty, phoneNumber: null })
      setDentistName(''); setMessage('Đã lưu nha sĩ.')
    } catch { setMessage('Không thể lưu nha sĩ.') }
  }

  const addAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await submit('appointments', { ...appointment, startAtUtc: new Date(appointment.startAtUtc).toISOString(), durationMinutes: 30, notes: null })
      setAppointment({ patientId: '', dentistId: '', startAtUtc: '', reason: '' }); setMessage('Đã tạo lịch hẹn.')
    } catch { setMessage('Không thể tạo lịch hẹn.') }
  }

  const updateStatus = async (id: string, status: string) => {
    const response = await fetch(`${apiUrl}/appointments/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (response.ok) {
      setMessage('Đã cập nhật trạng thái lịch hẹn.')
      await load()
    }
  }

  const addTreatment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await submit('treatment-records', { ...treatment, performedAtUtc: new Date().toISOString(), cost: Number(treatment.cost), notes: null })
      setTreatment({ patientId: '', dentistId: '', toothNumber: '', diagnosis: '', procedureName: '', cost: '' }); setMessage('Đã ghi nhận điều trị.')
    } catch { setMessage('Không thể ghi nhận điều trị.') }
  }

  const addPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await submit('payments', { patientId: payment.patientId, amount: Number(payment.amount), method: Number(payment.method), notes: null })
      setPayment({ patientId: '', amount: '', method: '0' }); setMessage('Đã ghi nhận thanh toán.')
    } catch { setMessage('Không thể ghi nhận thanh toán.') }
  }

  return <main className="page">
    <header><p className="eyebrow">BLUE DENTAL</p><h1>Quản lý nha khoa</h1><p>Theo dõi bệnh nhân, nha sĩ và lịch hẹn tại một nơi.</p>{message && <p className="message">{message}</p>}</header>
    <section className="metrics">
      <article><span>Bệnh nhân</span><strong>{dashboard?.patientCount ?? '—'}</strong></article>
      <article><span>Lịch hẹn hôm nay</span><strong>{dashboard?.appointmentsToday ?? '—'}</strong></article>
      <article><span>Chờ xác nhận</span><strong>{dashboard?.pendingAppointments ?? '—'}</strong></article>
      <article><span>Doanh thu hôm nay</span><strong>{dashboard ? `${dashboard.revenueToday.toLocaleString('vi-VN')} ₫` : '—'}</strong></article>
    </section>
    <section className="content">
      <div className="panel"><h2>Thêm bệnh nhân</h2><form onSubmit={addPatient}>
        <label>Họ và tên<input value={patientName} onChange={(event) => setPatientName(event.target.value)} required /></label>
        <label>Số điện thoại<input value={patientPhone} onChange={(event) => setPatientPhone(event.target.value)} required /></label><button>Lưu bệnh nhân</button>
        <label>Email<input type="email" value={patientEmail} onChange={(event) => setPatientEmail(event.target.value)} /></label>
        <label>Địa chỉ<input value={patientAddress} onChange={(event) => setPatientAddress(event.target.value)} /></label>
        <label>Ghi chú y khoa<input value={patientNotes} onChange={(event) => setPatientNotes(event.target.value)} /></label><button>{editingPatientId ? 'Cập nhật bệnh nhân' : 'Lưu bệnh nhân'}</button>
        {editingPatientId && <button type="button" className="secondary" onClick={() => { setEditingPatientId(undefined); setPatientName(''); setPatientPhone(''); setPatientEmail(''); setPatientAddress(''); setPatientNotes('') }}>Huỷ chỉnh sửa</button>}
      </form></div>
      <div className="panel"><h2>Tìm bệnh nhân</h2><input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Tên hoặc số điện thoại" />
        {matchingPatients.length === 0 ? <p>Không tìm thấy bệnh nhân.</p> : <ul>{matchingPatients.slice(0, 6).map((patient) => <li key={patient.id}><b>{patient.fullName}</b><span>{patient.phoneNumber}</span><div className="actions"><button onClick={() => setSelectedPatientId(patient.id)}>Hồ sơ</button><button onClick={() => editPatient(patient)}>Sửa</button></div></li>)}</ul>}
      </div>
      {selectedPatient && <div className="panel patient-profile"><h2>Hồ sơ: {selectedPatient.fullName}</h2><p>{selectedPatient.phoneNumber}{selectedPatient.email ? ` · ${selectedPatient.email}` : ''}</p><div className="profile-metrics"><span>{patientAppointments.length} lịch hẹn</span><span>{patientTreatments.length} điều trị</span><span>{patientTotalPaid.toLocaleString('vi-VN')} VND đã thu</span></div>
        <h3>Lịch sử điều trị</h3>{patientTreatments.length === 0 ? <p>Chưa có điều trị.</p> : <ul>{patientTreatments.slice(0, 4).map((item) => <li key={item.id}><b>{item.procedureName}</b><span>Răng {item.toothNumber || '—'} · {item.cost.toLocaleString('vi-VN')} VND</span></li>)}</ul>}
        <h3>Thanh toán</h3>{patientPayments.length === 0 ? <p>Chưa có thanh toán.</p> : <ul>{patientPayments.slice(0, 4).map((item) => <li key={item.id}><b>{item.amount.toLocaleString('vi-VN')} VND</b><span>{new Date(item.paidAtUtc).toLocaleString('vi-VN')}</span></li>)}</ul>}
        <h3>Lịch hẹn</h3>{patientAppointments.length === 0 ? <p>Chưa có lịch hẹn.</p> : <ul>{patientAppointments.slice(0, 4).map((item) => <li key={item.id}><b>{item.reason}</b><span>{new Date(item.startAtUtc).toLocaleString('vi-VN')} · {item.status}</span></li>)}</ul>}
      </div>}
      <div className="panel"><h2>Thêm nha sĩ</h2><form onSubmit={addDentist}>
        <label>Họ và tên<input value={dentistName} onChange={(event) => setDentistName(event.target.value)} required /></label>
        <label>Chuyên môn<input value={specialty} onChange={(event) => setSpecialty(event.target.value)} required /></label><button>Lưu nha sĩ</button>
      </form></div>
      <div className="panel"><h2>Tạo lịch hẹn</h2><form onSubmit={addAppointment}>
        <label>Bệnh nhân<select value={appointment.patientId} onChange={(event) => setAppointment({ ...appointment, patientId: event.target.value })} required><option value="">Chọn bệnh nhân</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label>
        <label>Nha sĩ<select value={appointment.dentistId} onChange={(event) => setAppointment({ ...appointment, dentistId: event.target.value })} required><option value="">Chọn nha sĩ</option>{dentists.map((dentist) => <option key={dentist.id} value={dentist.id}>{dentist.fullName} — {dentist.specialty}</option>)}</select></label>
        <label>Thời gian<input type="datetime-local" value={appointment.startAtUtc} onChange={(event) => setAppointment({ ...appointment, startAtUtc: event.target.value })} required /></label>
        <label>Lý do<input value={appointment.reason} onChange={(event) => setAppointment({ ...appointment, reason: event.target.value })} required /></label><button>Tạo lịch hẹn</button>
      </form></div>
      <div className="panel"><h2>Lịch hẹn sắp tới</h2>{appointments.length === 0 ? <p>Chưa có lịch hẹn nào.</p> : <ul>{appointments.slice(0, 6).map((item) => <li key={item.id}><b>{item.patient?.fullName ?? 'Bệnh nhân'}</b><span>{new Date(item.startAtUtc).toLocaleString('vi-VN')} · {item.dentist?.fullName}</span><div className="actions"><em>{item.status}</em>{item.status === 'Scheduled' && <button onClick={() => void updateStatus(item.id, 'Confirmed')}>Xác nhận</button>}{item.status === 'Confirmed' && <button onClick={() => void updateStatus(item.id, 'Completed')}>Hoàn thành</button>}</div></li>)}</ul>}</div>
      <div className="panel"><h2>Ghi nhận điều trị</h2><form onSubmit={addTreatment}>
        <label>Bệnh nhân<select value={treatment.patientId} onChange={(event) => setTreatment({ ...treatment, patientId: event.target.value })} required><option value="">Chọn bệnh nhân</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label>
        <label>Nha sĩ<select value={treatment.dentistId} onChange={(event) => setTreatment({ ...treatment, dentistId: event.target.value })} required><option value="">Chọn nha sĩ</option>{dentists.map((dentist) => <option key={dentist.id} value={dentist.id}>{dentist.fullName}</option>)}</select></label>
        <label>Số răng<input value={treatment.toothNumber} onChange={(event) => setTreatment({ ...treatment, toothNumber: event.target.value })} placeholder="Ví dụ: 16" /></label>
        <label>Chẩn đoán<input value={treatment.diagnosis} onChange={(event) => setTreatment({ ...treatment, diagnosis: event.target.value })} required /></label>
        <label>Thủ thuật<input value={treatment.procedureName} onChange={(event) => setTreatment({ ...treatment, procedureName: event.target.value })} required /></label>
        <label>Chi phí (VND)<input type="number" min="0" value={treatment.cost} onChange={(event) => setTreatment({ ...treatment, cost: event.target.value })} required /></label><button>Lưu điều trị</button>
      </form></div>
      <div className="panel"><h2>Điều trị gần đây</h2>{treatments.length === 0 ? <p>Chưa có hồ sơ điều trị.</p> : <ul>{treatments.slice(0, 6).map((item) => <li key={item.id}><b>{item.patient?.fullName} · {item.procedureName}</b><span>Răng {item.toothNumber || '—'} · {item.cost.toLocaleString('vi-VN')} VND</span></li>)}</ul>}</div>
      <div className="panel"><h2>Ghi nhận thanh toán</h2><form onSubmit={addPayment}>
        <label>Bệnh nhân<select value={payment.patientId} onChange={(event) => setPayment({ ...payment, patientId: event.target.value })} required><option value="">Chọn bệnh nhân</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label>
        <label>Số tiền (VND)<input type="number" min="1" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} required /></label>
        <label>Phương thức<select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}><option value="0">Tiền mặt</option><option value="1">Chuyển khoản</option><option value="2">Thẻ</option><option value="3">Ví điện tử</option></select></label><button>Ghi nhận thanh toán</button>
      </form></div>
      <div className="panel"><h2>Thanh toán gần đây</h2>{payments.length === 0 ? <p>Chưa có thanh toán nào.</p> : <ul>{payments.slice(0, 6).map((item) => <li key={item.id}><b>{item.patient?.fullName}</b><span>{item.amount.toLocaleString('vi-VN')} VND · {['Tiền mặt', 'Chuyển khoản', 'Thẻ', 'Ví điện tử'][item.method]}</span></li>)}</ul>}</div>
    </section>
  </main>
}
